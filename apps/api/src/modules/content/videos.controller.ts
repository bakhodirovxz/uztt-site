import {
  Body,
  Controller,
  Delete,
  Get,
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
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { pickTranslation } from './locale.util';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';

class VideoTrDto {
  @ApiProperty({ enum: ['uz', 'ru', 'en'] })
  @IsIn(['uz', 'ru', 'en'])
  locale!: string;
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
}

class CreateVideoDto {
  @ApiProperty({ example: 'dQw4w9WgXcQ' })
  @Matches(/^[A-Za-z0-9_-]{6,20}$/, { message: 'YouTube ID formati noto‘g‘ri' })
  youtubeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional({ description: "Musobaqaga bog'lash" })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiProperty({ type: [VideoTrDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VideoTrDto)
  translations!: VideoTrDto[];
}

@ApiTags('videos')
@Revalidates('media')
@Controller('videos')
export class VideosController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @CacheFor(120)
  @Get()
  async list(
    @Query('locale') locale?: string,
    @Query('category') category?: string,
    @Query('tournamentId') tournamentId?: string,
  ) {
    const videos = await this.prisma.video.findMany({
      where: {
        publishedAt: { not: null },
        category: category || undefined,
        tournamentId: tournamentId || undefined,
      },
      orderBy: { publishedAt: 'desc' },
      take: 60,
      include: { translations: true },
    });
    return videos.map((v) => ({
      id: v.id,
      youtubeId: v.youtubeId,
      category: v.category,
      isFeatured: v.isFeatured,
      publishedAt: v.publishedAt,
      title: pickTranslation(v.translations, locale)?.title ?? '',
    }));
  }

  @Post()
  @RequirePermissions('media.manage')
  create(@Body() dto: CreateVideoDto) {
    return this.prisma.video.create({
      data: {
        youtubeId: dto.youtubeId,
        category: dto.category,
        tournamentId: dto.tournamentId,
        isFeatured: dto.isFeatured ?? false,
        publishedAt: new Date(),
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
  }

  @Delete(':id')
  @RequirePermissions('media.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.video.delete({ where: { id } });
    return { ok: true };
  }
}
