import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { pickTranslation } from './locale.util';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';

class PageTrDto {
  @ApiProperty({ enum: ['uz', 'ru', 'en'] })
  @IsIn(['uz', 'ru', 'en'])
  locale!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @ApiProperty({ description: 'Markdown matn' })
  @IsString()
  @MinLength(2)
  body!: string;
}

class CreatePageDto {
  @ApiProperty({ example: 'privacy' })
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Kalitda faqat kichik harf, raqam va - bo‘lishi mumkin',
  })
  key!: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInFooter?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiProperty({ type: [PageTrDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PageTrDto)
  translations!: PageTrDto[];
}

class UpdatePageDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showInFooter?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;

  @ApiPropertyOptional({ type: [PageTrDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageTrDto)
  translations?: PageTrDto[];
}

/** Statik sahifalar: maxfiylik siyosati, foydalanish shartlari va h.k. */
@ApiTags('pages')
@Revalidates('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Footer havolalari uchun ro'yxat */
  @Public()
  @CacheFor(300)
  @Get()
  async list(@Query('locale') locale?: string) {
    const pages = await this.prisma.page.findMany({
      where: { showInFooter: true },
      orderBy: { sortOrder: 'asc' },
      include: { translations: true },
    });
    return pages.map((p) => ({
      key: p.key,
      title: pickTranslation(p.translations, locale)?.title ?? p.key,
    }));
  }

  @Get('admin/all')
  @RequirePermissions('page.manage')
  adminList() {
    return this.prisma.page.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { translations: true },
    });
  }

  @Public()
  @CacheFor(300)
  @Get(':key')
  async detail(@Param('key') key: string, @Query('locale') locale?: string) {
    const page = await this.prisma.page.findUnique({
      where: { key },
      include: { translations: true },
    });
    if (!page) throw new NotFoundException('Sahifa topilmadi');
    const tr = pickTranslation(page.translations, locale);
    if (!tr) throw new NotFoundException('Sahifa matni topilmadi');
    return {
      key: page.key,
      locale: tr.locale,
      title: tr.title,
      body: tr.body,
      updatedAt: page.updatedAt,
    };
  }

  @Post()
  @RequirePermissions('page.manage')
  async create(@Body() dto: CreatePageDto) {
    const exists = await this.prisma.page.findUnique({
      where: { key: dto.key },
    });
    if (exists) throw new BadRequestException('Bu kalit band');
    return this.prisma.page.create({
      data: {
        key: dto.key,
        showInFooter: dto.showInFooter ?? true,
        sortOrder: dto.sortOrder ?? 0,
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
  }

  @Put(':id')
  @RequirePermissions('page.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
  ) {
    const exists = await this.prisma.page.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Sahifa topilmadi');

    for (const t of dto.translations ?? []) {
      await this.prisma.pageTranslation.upsert({
        where: { pageId_locale: { pageId: id, locale: t.locale } },
        update: { title: t.title, body: t.body },
        create: { pageId: id, locale: t.locale, title: t.title, body: t.body },
      });
    }

    return this.prisma.page.update({
      where: { id },
      data: { showInFooter: dto.showInFooter, sortOrder: dto.sortOrder },
      include: { translations: true },
    });
  }

  @Delete(':id')
  @RequirePermissions('page.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Sahifa topilmadi');
    // Tizim sahifalari (maxfiylik, shartlar) — huquqiy talab, o'chirilmaydi
    if (page.isSystem) {
      throw new BadRequestException(
        'Tizim sahifasini o‘chirib bo‘lmaydi — matnini tahrirlang',
      );
    }
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
  }
}
