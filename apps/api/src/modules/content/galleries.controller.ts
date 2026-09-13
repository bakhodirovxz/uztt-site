import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { pickTranslation } from './locale.util';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';

class GalleryTrDto {
  @ApiProperty({ enum: ['uz', 'ru', 'en'] })
  @IsIn(['uz', 'ru', 'en'])
  locale!: string;
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
}

class CreateGalleryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;
  @ApiPropertyOptional({ description: "Musobaqaga bog'lash" })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;
  @ApiProperty({ type: [GalleryTrDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GalleryTrDto)
  translations!: GalleryTrDto[];
}

class AddPhotoDto {
  @ApiProperty() @IsString() @MaxLength(500) url!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbUrl?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  credit?: string;
}

@ApiTags('galleries')
@Revalidates('media')
@Controller('galleries')
export class GalleriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @CacheFor(120)
  @Get()
  async list(
    @Query('locale') locale?: string,
    @Query('tournamentId') tournamentId?: string,
  ) {
    const galleries = await this.prisma.gallery.findMany({
      where: { status: 'PUBLISHED', tournamentId },
      orderBy: { publishedAt: 'desc' },
      take: 40,
      include: {
        translations: true,
        _count: { select: { photos: true } },
        photos: { take: 1, orderBy: { sortOrder: 'asc' } },
      },
    });
    return galleries.map((g) => ({
      id: g.id,
      coverUrl: g.coverUrl ?? g.photos[0]?.thumbUrl ?? g.photos[0]?.url ?? null,
      photoCount: g._count.photos,
      publishedAt: g.publishedAt,
      title: pickTranslation(g.translations, locale)?.title ?? '',
    }));
  }

  @Public()
  @CacheFor(120)
  @Get(':id')
  async detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('locale') locale?: string,
  ) {
    const g = await this.prisma.gallery.findUnique({
      where: { id },
      include: {
        translations: true,
        photos: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!g || g.status !== 'PUBLISHED') {
      throw new NotFoundException('Galereya topilmadi');
    }
    return {
      id: g.id,
      title: pickTranslation(g.translations, locale)?.title ?? '',
      publishedAt: g.publishedAt,
      photos: g.photos,
    };
  }

  @Post()
  @RequirePermissions('media.manage')
  create(@Body() dto: CreateGalleryDto) {
    return this.prisma.gallery.create({
      data: {
        coverUrl: dto.coverUrl,
        tournamentId: dto.tournamentId,
        publishedAt: new Date(),
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
  }

  @Post(':id/photos')
  @RequirePermissions('media.manage')
  async addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPhotoDto,
  ) {
    const count = await this.prisma.photo.count({ where: { galleryId: id } });
    return this.prisma.photo.create({
      data: { galleryId: id, ...dto, sortOrder: count },
    });
  }

  @Delete(':id')
  @RequirePermissions('media.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.gallery.delete({ where: { id } });
    return { ok: true };
  }
}
