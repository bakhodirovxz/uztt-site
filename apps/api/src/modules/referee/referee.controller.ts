import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class UpdateRefereeProfileDto {
  @ApiPropertyOptional({ example: 'Milliy toifa' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  certification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ description: 'Hakamlik faoliyati boshlangan yil' })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  since?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}

/**
 * Hakam profili va statistikasi.
 * Statistika alohida ustunlarda saqlanmaydi — o'yinlar jadvalidan hisoblanadi,
 * shunda undo/tuzatishlardan keyin ham raqamlar haqiqatga mos qoladi.
 */
@ApiTags('referee')
@Controller('referee')
export class RefereeController {
  constructor(private readonly prisma: PrismaService) {}

  /** O'z profili (hakam paneli uchun) */
  @Get('me')
  @RequirePermissions('match.score')
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.prisma.refereeProfile.findUnique({
      where: { userId: user.id },
    });
    return { profile, stats: await this.statsOf(user.id) };
  }

  @Put('me')
  @RequirePermissions('match.score')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRefereeProfileDto,
  ) {
    return this.prisma.refereeProfile.upsert({
      where: { userId: user.id },
      update: dto,
      create: { userId: user.id, ...dto },
    });
  }

  /** Hakamlar ro'yxati statistikasi bilan (musobaqa kotibi uchun) */
  @Get()
  @RequirePermissions('match.manage')
  async list() {
    const referees = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              permissions: { some: { permission: { code: 'match.score' } } },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        refereeProfile: true,
      },
    });
    // Statistika har hakam uchun alohida emas — uchta guruhlangan so'rovda
    // (aks holda hakamlar soniga ko'paytirilgan N+1 bo'lardi)
    const ids = referees.map((r) => r.id);
    const stats = await this.statsFor(ids);
    return referees.map((r) => ({
      ...r,
      stats: stats.get(r.id) ?? {
        matches: 0,
        finished: 0,
        cards: 0,
        disqualifications: 0,
      },
    }));
  }

  @Get(':userId')
  @RequirePermissions('match.manage')
  async detail(@Param('userId', ParseUUIDPipe) userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        refereeProfile: true,
      },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return { ...user, stats: await this.statsOf(userId) };
  }

  /** Bitta hakam statistikasi */
  private async statsOf(userId: string) {
    const stats = await this.statsFor([userId]);
    return (
      stats.get(userId) ?? {
        matches: 0,
        finished: 0,
        cards: 0,
        disqualifications: 0,
      }
    );
  }

  /**
   * O'yinlar, yakunlanganlar, kartochkalar va diskvalifikatsiyalar soni —
   * bir nechta hakam uchun uchta guruhlangan so'rovda.
   */
  private async statsFor(userIds: string[]) {
    const result = new Map<
      string,
      {
        matches: number;
        finished: number;
        cards: number;
        disqualifications: number;
      }
    >();
    if (userIds.length === 0) return result;

    const [byUser, finishedByUser, events] = await Promise.all([
      this.prisma.match.groupBy({
        by: ['verifiedByUserId'],
        where: { verifiedByUserId: { in: userIds } },
        _count: { _all: true },
      }),
      this.prisma.match.groupBy({
        by: ['verifiedByUserId'],
        where: { verifiedByUserId: { in: userIds }, status: 'FINISHED' },
        _count: { _all: true },
      }),
      this.prisma.matchEvent.groupBy({
        by: ['actorUserId', 'type'],
        where: {
          actorUserId: { in: userIds },
          type: { in: ['CARD', 'DISQUALIFY'] },
        },
        _count: { _all: true },
      }),
    ]);

    for (const id of userIds) {
      result.set(id, {
        matches:
          byUser.find((r) => r.verifiedByUserId === id)?._count._all ?? 0,
        finished:
          finishedByUser.find((r) => r.verifiedByUserId === id)?._count._all ??
          0,
        cards:
          events.find((e) => e.actorUserId === id && e.type === 'CARD')?._count
            ._all ?? 0,
        disqualifications:
          events.find((e) => e.actorUserId === id && e.type === 'DISQUALIFY')
            ?._count._all ?? 0,
      });
    }
    return result;
  }
}
