import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  IsIn,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ShowcaseService } from './showcase.service';
import { TelegramService } from './telegram.service';

/** Faqat o'zimizning yuklangan rasm manzili — tashqi URL/`javascript:` kiritib bo'lmaydi */
const OWN_VIDEO = /^\/uploads\/videos\/[\w-]{1,80}\.(mp4|webm)$/;
const OWN_IMAGE = /^\/uploads\/images\/[\w-]{1,80}\.webp$/;
const TABLES = /^$|^\d{1,2}(,\d{1,2}){0,15}$/;

class TelegramTestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() matchId?: string;
}

class CreateAdDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @ApiPropertyOptional({ enum: ['IMAGE', 'VIDEO', 'PROMO'] }) @IsOptional() @IsIn(['IMAGE', 'VIDEO', 'PROMO']) kind?: 'IMAGE' | 'VIDEO' | 'PROMO';
  @ApiPropertyOptional({ example: '/uploads/images/<uuid>.webp' })
  @IsOptional()
  @Matches(OWN_IMAGE, { message: "Rasm manzili noto'g'ri" })
  imageUrl?: string;
  @ApiPropertyOptional({ example: '/uploads/videos/<uuid>.mp4' })
  @IsOptional()
  @Matches(OWN_VIDEO, { message: "Rolik manzili noto'g'ri" })
  videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(3) @Max(30) durationS?: number;
  @ApiPropertyOptional({ example: '1,2' })
  @IsOptional()
  @Matches(TABLES, { message: "Stollar '1,2' ko'rinishida bo'lishi kerak" })
  tables?: string;
}

class UpdateAdDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(80) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(3) @Max(30) durationS?: number;
  @ApiPropertyOptional() @IsOptional() @Matches(TABLES) tables?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

/**
 * Efir qo'shimchalari: o'yin boshidagi o'yinchi kartochkalari, o'yin tugagandagi
 * reyting yangilanishi, overlay reklamasi va Telegram.
 * Ommaviy GET'lar faqat `ShowcaseService` dagi xavfsiz maydonlarni qaytaradi.
 */
@ApiTags('showcase')
@Controller('showcase')
export class ShowcaseController {
  constructor(
    private readonly showcase: ShowcaseService,
    private readonly telegram: TelegramService,
  ) {}

  @Public()
  @CacheFor(5)
  @Get('match/:id/profiles')
  profiles(@Param('id', ParseUUIDPipe) id: string) {
    return this.showcase.profiles(id);
  }

  @Public()
  @CacheFor(10)
  @Get('match/:id/rating')
  rating(@Param('id', ParseUUIDPipe) id: string) {
    return this.showcase.rating(id);
  }

  @Public()
  @CacheFor(5)
  @Get('ads')
  ads(@Query('table') table?: string) {
    const n = table ? parseInt(table, 10) : NaN;
    return this.showcase.publicAds(Number.isInteger(n) ? n : undefined);
  }

  /** TV/overlay bo'sh vaqt aylanmasi uchun ma'lumot (ommaviy, faqat ism/natija) */
  @Public()
  @CacheFor(5)
  @Get('idle')
  idle(@Query('table') table?: string) {
    const n = table ? parseInt(table, 10) : NaN;
    return this.showcase.idleFeed(Number.isInteger(n) && n > 0 && n < 100 ? n : 1);
  }

  // ---------- admin ----------
  @Get('ads/all')
  @RequirePermissions('media.manage')
  adminAds() {
    return this.showcase.adminAds();
  }

  @Post('ads')
  @RequirePermissions('media.manage')
  createAd(@Body() dto: CreateAdDto) {
    return this.showcase.createAd(dto);
  }

  @Patch('ads/:id')
  @RequirePermissions('media.manage')
  updateAd(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdDto) {
    return this.showcase.updateAd(id, dto);
  }

  @Delete('ads/:id')
  @RequirePermissions('media.manage')
  deleteAd(@Param('id', ParseUUIDPipe) id: string) {
    return this.showcase.deleteAd(id);
  }

  /** Telegram ulanishini tekshirish: oxirgi tugagan o'yinning rasmlarini (2 format) yuboradi */
  @Post('telegram/test')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequirePermissions('user.manage')
  telegramTest(@Body() body: TelegramTestDto) {
    return this.telegram.sendTest(body.matchId);
  }
}
