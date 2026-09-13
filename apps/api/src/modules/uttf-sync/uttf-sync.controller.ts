import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { UttfSyncService } from './uttf-sync.service';

/**
 * uttf.uz sinxronizatsiyasi — FAQAT admin uchun.
 *
 * `@Public()` QO'YILMAGAN: global `JwtAuthGuard` secure-by-default
 * ishlagani uchun shunchaki belgilamaslik yetarli. Ustiga `uttf.sync`
 * permission talab qilinadi.
 */
export class RunSyncDto {
  @IsIn(['tournaments', 'tournament-names', 'players', 'videos'])
  scope!: 'tournaments' | 'tournament-names' | 'players' | 'videos';

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
@Controller('uttf-sync')
export class UttfSyncController {
  constructor(private readonly sync: UttfSyncService) {}

  /** Manba va bizdagi holatni solishtiradi — hech narsa yozmaydi */
  @Get('status')
  @RequirePermissions('uttf.sync')
  status() {
    return this.sync.syncTournaments({ dryRun: true });
  }

  @Post('run')
  @RequirePermissions('uttf.sync')
  run(@Body() dto: RunSyncDto) {
    const dryRun = dto.dryRun ?? true;
    if (dto.scope === 'tournament-names') {
      return this.sync.syncTournamentNames({ dryRun, limit: dto.limit });
    }
    if (dto.scope === 'players') {
      return this.sync.syncPlayers({ dryRun, limit: dto.limit });
    }
    if (dto.scope === 'videos') {
      return this.sync.syncVideos({ dryRun });
    }
    return this.sync.syncTournaments({ dryRun, limit: dto.limit });
  }
}
