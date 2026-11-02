import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';

const DIR = join(process.cwd(), 'uploads', 'public', 'players');

/**
 * O'yinchi rasmi. Xavfsizlik: mijoz yuborgan mime ishonchsiz — sharp haqiqiy formatni aniqlaydi (faqat JPEG/PNG/WebP),
 * piksel chegarasi bor, rasm QAYTA KODLANADI (EXIF/ixtiyoriy metama'lumot va ichiga yashirilgan kod tushib qoladi),
 * fayl nomi serverda yaratiladi (foydalanuvchi nomi ishlatilmaydi).
 */
@Injectable()
export class PlayerPhotoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kim rasm yuklay oladi: player.manage, o'yinchining o'zi, yoki uning tasdiqlangan murabbiyi */
  private async assertCanEdit(playerId: string, user: { id: string; permissions: string[] }) {
    const p = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true, userId: true, photoUrl: true } });
    if (!p) throw new NotFoundException("O'yinchi topilmadi");
    if (user.permissions.includes('player.manage') || p.userId === user.id) return p;
    const coach = await this.prisma.coachProfile.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
    if (coach?.status === 'APPROVED') {
      const link = await this.prisma.coachPlayer.findUnique({ where: { coachId_playerId: { coachId: coach.id, playerId } } });
      if (link) return p;
    }
    throw new ForbiddenException("Bu o'yinchi rasmini o'zgartirish huquqi yo'q");
  }

  async upload(playerId: string, file: Express.Multer.File | undefined, user: { id: string; permissions: string[] }) {
    const player = await this.assertCanEdit(playerId, user);
    if (!file) throw new BadRequestException('Fayl kiritilmadi');
    let meta;
    try {
      meta = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
      throw new BadRequestException('Rasm o‘qib bo‘lmadi');
    }
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
      throw new BadRequestException('Faqat JPEG, PNG yoki WebP rasm');
    }
    if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
      throw new BadRequestException('Rasm kamida 200×200 piksel bo‘lishi kerak');
    }

    mkdirSync(DIR, { recursive: true });
    const base = `${playerId}-${randomBytes(4).toString('hex')}`;
    const src = () => sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate();
    await src().resize(600, 800, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toFile(join(DIR, `${base}.webp`));
    await src().resize(96, 96, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 70 }).toFile(join(DIR, `${base}-thumb.webp`));

    const url = `/uploads/players/${base}.webp`;
    await this.prisma.player.update({ where: { id: playerId }, data: { photoUrl: url } });

    // Eski yuklangan rasm (faqat biz yaratgan) o'chiriladi
    const old = player.photoUrl?.match(/^\/uploads\/players\/([\w-]+)\.webp$/)?.[1];
    if (old) {
      for (const f of [`${old}.webp`, `${old}-thumb.webp`]) {
        const path = join(DIR, f);
        if (existsSync(path)) {
          try { unlinkSync(path); } catch { /* e'tiborsiz */ }
        }
      }
    }
    return { photoUrl: url, thumbUrl: `/uploads/players/${base}-thumb.webp` };
  }
}
