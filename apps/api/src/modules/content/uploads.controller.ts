import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

const IMAGES_DIR = join(process.cwd(), 'uploads', 'public', 'images');
const VIDEOS_DIR = join(process.cwd(), 'uploads', 'public', 'videos');
const DOCS_DIR = join(process.cwd(), 'uploads', 'public', 'documents');

/**
 * Hujjat turlari — mime yetarli emas (mijoz yuborgan sarlavha), shuning uchun
 * fayl boshidagi magic baytlar ham tekshiriladi.
 */
const DOC_TYPES: Array<{
  ext: string;
  mime: string;
  magic: number[];
}> = [
  { ext: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  {
    ext: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: [0x50, 0x4b, 0x03, 0x04], // PK.. (zip konteyner)
  },
  {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    magic: [0x50, 0x4b, 0x03, 0x04],
  },
];

/** ffprobe bor bo'lsa: haqiqiy video oqimi va davomiyligi (soniya). Yo'q bo'lsa null. */
function probe(path: string): Promise<{ video: boolean; seconds: number } | null> {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path],
      { timeout: 15_000 },
      (err, stdout) => {
        if (err) return resolve(null);
        try {
          const j = JSON.parse(stdout) as { streams?: Array<{ codec_type?: string }>; format?: { duration?: string } };
          resolve({ video: !!j.streams?.some((x) => x.codec_type === 'video'), seconds: Number(j.format?.duration ?? 0) });
        } catch {
          resolve(null);
        }
      },
    );
  });
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Rasm yuklash: sharp bilan webp (max 1600px) + thumb (400px) */
  @Post('image')
  @RequirePermissions('media.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Fayl kiritilmadi');
    if (!/^image\/(jpeg|png|webp|avif)/.test(file.mimetype)) {
      throw new BadRequestException('Faqat JPEG/PNG/WebP/AVIF');
    }

    mkdirSync(IMAGES_DIR, { recursive: true });
    const id = randomUUID();

    const main = sharp(file.buffer).rotate().resize(1600, 1600, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    const mainInfo = await main
      .webp({ quality: 82 })
      .toFile(join(IMAGES_DIR, `${id}.webp`));
    await sharp(file.buffer)
      .rotate()
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(join(IMAGES_DIR, `${id}-thumb.webp`));

    return this.prisma.mediaAsset.create({
      data: {
        kind: 'IMAGE',
        url: `/uploads/images/${id}.webp`,
        thumbUrl: `/uploads/images/${id}-thumb.webp`,
        width: mainInfo.width,
        height: mainInfo.height,
        size: mainInfo.size,
        mimeType: 'image/webp',
        uploadedById: user.id,
      },
    });
  }

  /** Hujjat yuklash (federatsiya hujjatlari): PDF / DOCX / XLSX */
  @Post('document')
  @RequirePermissions('page.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Fayl kiritilmadi');

    const declared = DOC_TYPES.find((t) => t.mime === file.mimetype);
    if (!declared) {
      throw new BadRequestException('Faqat PDF, DOCX yoki XLSX');
    }
    const head = [...file.buffer.subarray(0, 4)];
    if (!declared.magic.every((b, i) => head[i] === b)) {
      throw new BadRequestException('Fayl mazmuni turiga mos emas');
    }

    mkdirSync(DOCS_DIR, { recursive: true });
    const id = randomUUID();
    const name = `${id}.${declared.ext}`;
    writeFileSync(join(DOCS_DIR, name), file.buffer);

    return this.prisma.mediaAsset.create({
      data: {
        kind: 'DOCUMENT',
        url: `/uploads/documents/${name}`,
        size: file.size,
        mimeType: declared.mime,
        uploadedById: user.id,
      },
    });
  }

  /**
   * Reklama roligi: MP4 (H.264) yoki WebM. Mime ishonilmaydi — magic baytlar + (bor bo'lsa) ffprobe.
   * 20 MB gacha (nginx limiti 25 MB). Davomiylik qaytariladi — reklama turiga qarab keyin tekshiriladi.
   */
  @Post('video')
  @RequirePermissions('media.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Fayl kiritilmadi');
    const b = file.buffer;
    const isMp4 = b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp';
    const isWebm = b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
    if (!isMp4 && !isWebm) throw new BadRequestException('Faqat MP4 yoki WebM');
    const ext = isMp4 ? 'mp4' : 'webm';

    mkdirSync(VIDEOS_DIR, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    const path = join(VIDEOS_DIR, name);
    writeFileSync(path, b);
    const info = await probe(path);
    if (info && (!info.video || !(info.seconds > 0))) {
      try { unlinkSync(path); } catch { /* e'tiborsiz */ }
      throw new BadRequestException('Fayl yaroqli video emas');
    }
    return { url: `/uploads/videos/${name}`, durationS: info ? Math.ceil(info.seconds) : null, checked: !!info };
  }
}
