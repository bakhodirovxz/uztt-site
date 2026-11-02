import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';
import { UttfSyncService } from './uttf-sync.service';
import { UttfContentService } from './uttf-content.service';

/**
 * uttf.uz sinxronizatsiyasi — FAQAT admin uchun.
 *
 * `@Public()` QO'YILMAGAN: global `JwtAuthGuard` secure-by-default
 * ishlagani uchun shunchaki belgilamaslik yetarli. Ustiga `uttf.sync`
 * permission talab qilinadi.
 */
export class RunSyncDto {
  @IsIn(['tournaments', 'tournament-names', 'players', 'videos', 'matches', 'news', 'clubs', 'photos'])
  scope!: 'tournaments' | 'tournament-names' | 'players' | 'videos' | 'matches' | 'news' | 'clubs' | 'photos';

  /** photos: mavjud (uttf-import) rasmlarni ham qayta yuklab almashtirish */
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  /**
   * Default TRUE — ataylab. Sinxronizatsiya hech qachon tasodifan
   * yozmasin: avval farqni ko'rasiz, keyin `dryRun: false` bilan
   * qayta yuborasiz.
   */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /** Sinov uchun nechta yozuv bilan cheklash */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}

@ApiTags('uttf-sync')
@Revalidates('tournaments', 'media', 'news')
@Controller('uttf-sync')
export class UttfSyncController {
  constructor(
    private readonly sync: UttfSyncService,
    private readonly content: UttfContentService,
  ) {}

  /** Manba va bizdagi holatni solishtiradi — hech narsa yozmaydi */
  @Get('status')
  @RequirePermissions('uttf.sync')
  status() {
    return this.sync.syncTournaments({ dryRun: true });
  }

  /** Manba bilan aloqa va javob shaklini tekshiradi (yozmaydi) */
  @Get('probe')
  @RequirePermissions('uttf.sync')
  probe() {
    return this.content.probe();
  }

  @Post('run')
  @RequirePermissions('uttf.sync')
  run(@Body() dto: RunSyncDto) {
    const dryRun = dto.dryRun ?? true;
    if (dto.scope === 'news') return this.content.syncNews({ dryRun });
    if (dto.scope === 'clubs') return this.content.syncClubs({ dryRun });
    if (dto.scope === 'photos') return this.content.syncPhotos({ dryRun, limit: dto.limit, force: dto.force });
    if (dto.scope === 'tournament-names') {
      return this.sync.syncTournamentNames({ dryRun, limit: dto.limit });
    }
    if (dto.scope === 'players') {
      return this.sync.syncPlayers({ dryRun, limit: dto.limit });
    }
    if (dto.scope === 'videos') {
      return this.sync.syncVideos({ dryRun });
    }
    if (dto.scope === 'matches') {
      return this.sync.syncMatches({ dryRun, limit: dto.limit });
    }
    return this.sync.syncTournaments({ dryRun, limit: dto.limit });
  }
}
