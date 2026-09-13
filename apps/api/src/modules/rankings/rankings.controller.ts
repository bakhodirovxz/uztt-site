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
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingsService } from './rankings.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class AdjustPointsDto {
  @ApiPropertyOptional({
    description: "Ballga qo'shiladigan (yoki ayiriladigan) miqdor",
  })
  @IsOptional()
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  delta?: number;

  @ApiPropertyOptional({ description: "Yakuniy ball (delta o'rniga)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  total?: number;

  @ApiProperty({ description: "O'zgartirish sababi (audit uchun majburiy)" })
  @IsString()
  @MaxLength(300)
  note!: string;
}

class CreateSnapshotDto {
  @ApiPropertyOptional({
    description: "Yorliq (bo'sh qolsa joriy ISO hafta: 2026-W33)",
    example: '2026-W33',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Yorliqda faqat harf, raqam, - va _ bo‘lishi mumkin',
  })
  label?: string;
}

@ApiTags('rankings')
@Controller('rankings')
export class RankingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankings: RankingsService,
  ) {}

  /**
   * Reyting jadvali. `snapshot` berilsa — tarixiy kesim,
   * aks holda joriy holat; ikkalasida ham ▲▼ oldingi kesimga nisbatan.
   */
  @Public()
  @Get()
  list(
    @Query('gender') gender?: Gender,
    @Query('ageCategory') ageCategory?: string,
    @Query('snapshot') snapshot?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rankings.list({
      gender:
        gender && Object.values(Gender).includes(gender) ? gender : undefined,
      ageCategory: ageCategory || undefined,
      snapshot: snapshot || undefined,
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });
  }

  /** Mavjud kesimlar ro'yxati (sana tanlagich uchun) */
  @Public()
  @Get('snapshots')
  snapshots() {
    return this.rankings.snapshots();
  }

  /** Juftlik reytingi (bir xil jinsli juftliklar) */
  @Public()
  @Get('doubles')
  doubles(
    @Query('gender') gender?: Gender,
    @Query('ageCategory') ageCategory?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rankings.listPartnerships(
      'DOUBLES',
      gender && Object.values(Gender).includes(gender) ? gender : undefined,
      ageCategory || undefined,
      page ? Number.parseInt(page, 10) : undefined,
      pageSize ? Number.parseInt(pageSize, 10) : undefined,
    );
  }

  /** Aralash juftlik reytingi */
  @Public()
  @Get('mixed')
  mixed(
    @Query('ageCategory') ageCategory?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rankings.listPartnerships(
      'MIXED_DOUBLES',
      undefined,
      ageCategory || undefined,
      page ? Number.parseInt(page, 10) : undefined,
      pageSize ? Number.parseInt(pageSize, 10) : undefined,
    );
  }

  /** Jamoaviy reyting. `gender=MIXED` — aralash jamoalar. */
  @Public()
  @Get('teams')
  teams(
    @Query('gender') gender?: string,
    @Query('ageCategory') ageCategory?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const g =
      gender === 'MIXED'
        ? ('MIXED' as const)
        : gender && Object.values(Gender).includes(gender as Gender)
          ? (gender as Gender)
          : undefined;
    return this.rankings.listTeams(
      g,
      ageCategory || undefined,
      page ? Number.parseInt(page, 10) : undefined,
      pageSize ? Number.parseInt(pageSize, 10) : undefined,
    );
  }

  /** Qo'lda kesim olish (haftalik cron'dan tashqari) */
  @Post('snapshots')
  @RequirePermissions('ranking.adjust')
  createSnapshot(@Body() dto: CreateSnapshotDto) {
    return this.rankings.createSnapshot({ label: dto.label, isAuto: false });
  }

  @Delete('snapshots/:id')
  @RequirePermissions('ranking.adjust')
  removeSnapshot(@Param('id', ParseUUIDPipe) id: string) {
    return this.rankings.removeSnapshot(id);
  }

  /**
   * Yig'ilgan ballni qo'lda tuzatish (operator/admin).
   * Har o'zgarish PlayerPointsLog'ga izohi va muallifi bilan yoziladi.
   */
  @Post('players/:id/adjust')
  @RequirePermissions('ranking.adjust')
  async adjust(
    @Param('id', ParseUUIDPipe) playerId: string,
    @Body() dto: AdjustPointsDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (dto.delta === undefined && dto.total === undefined) {
      throw new BadRequestException('delta yoki total ko‘rsatilishi kerak');
    }
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        rankingPoints: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!player) throw new NotFoundException("O'yinchi topilmadi");

    const requested =
      dto.delta !== undefined ? dto.delta : dto.total! - player.rankingPoints;
    // Ball manfiy bo'lmaydi — shuning uchun delta ham cheklanadi,
    // aks holda log va keshdagi ball bir-biriga mos kelmay qoladi.
    const newTotal = Math.max(0, player.rankingPoints + requested);
    const delta = newTotal - player.rankingPoints;
    if (delta === 0) {
      throw new BadRequestException("Ball o'zgarmadi");
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.playerPointsLog.create({
        data: {
          playerId,
          delta,
          reason: 'ADJUSTMENT',
          note: dto.note,
          createdById: user.id,
        },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { rankingPoints: newTotal },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rankingPoints: true,
        },
      }),
    ]);
    return { ...updated, delta, note: dto.note };
  }

  /** Ball tarixi (tuzatishlar va o'yin ballari) */
  @Get('players/:id/log')
  @RequirePermissions('ranking.adjust')
  log(@Param('id', ParseUUIDPipe) playerId: string) {
    return this.prisma.playerPointsLog.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        delta: true,
        reason: true,
        note: true,
        matchId: true,
        createdAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
