import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addPlayerPoints } from '../../common/points';
import {
  penaltyPoints,
  placeBonus,
  placeFromExit,
  tournamentK,
} from './rating.engine';

export interface BonusRow {
  playerId: string;
  place: number;
  bonus: number;
}

const BONUS_NOTE = 'Nizom: bonus';
const PENALTY_NOTE = 'Nizom: jarima';

/** Musobaqa yakunida: 1–8-o'rin bonuslari (Б) va hakam taqdimnomasi bo'yicha jarima (Ж). */
@Injectable()
export class RatingService {
  constructor(private readonly prisma: PrismaService) {}

  private async context(tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { level: true, ageCategory: { select: { code: true } } },
    });
    if (!t) throw new NotFoundException('Musobaqa topilmadi');
    if (t.level.ratingMode !== 'OFFICIAL') {
      throw new BadRequestException(
        "Bu musobaqa darajasi eski (LEGACY) hisobda — Nizom bonusi qo'llanmaydi",
      );
    }
    return { t, k: tournamentK(t.level.ratingK, t.ageCategory?.code) };
  }

  /** O'rinlar: final (1/2), yarim final yutqazganlar (3), chorak final yutqazganlar (5) — setka (draw) bo'yicha. */
  async places(tournamentId: string): Promise<Map<string, number>> {
    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: 'FINISHED',
        stage: { in: ['FINAL', 'THIRD_PLACE', 'SEMIFINAL', 'QUARTERFINAL'] },
        winnerId: { not: null },
      },
      select: {
        stage: true,
        winnerId: true,
        player1Id: true,
        player2Id: true,
        disqualifiedPlayerId: true,
      },
    });
    const best = new Map<string, number>();
    const put = (id: string | null, place: number | null) => {
      if (!id || place === null) return;
      const prev = best.get(id);
      if (prev === undefined || place < prev) best.set(id, place);
    };
    // 3-o'rin uchun o'yin o'tkazilgan bo'lsa — yarim final yutqazganlari 3 emas, 3/4 (o'sha o'yin bo'yicha)
    const hasThird = matches.some((m) => m.stage === 'THIRD_PLACE');
    for (const m of matches) {
      const loserId = m.player1Id === m.winnerId ? m.player2Id : m.player1Id;
      if (hasThird && m.stage === 'SEMIFINAL') {
        put(m.winnerId, placeFromExit(m.stage, true));
        continue;
      }
      put(m.winnerId, placeFromExit(m.stage, true));
      // diskvalifikatsiya qilingan o'yinchi bonus olmaydi
      if (loserId && loserId !== m.disqualifiedPlayerId) {
        put(loserId, placeFromExit(m.stage, false));
      }
    }
    return best;
  }

  /** Bonuslarni hisoblaydi; `apply` bo'lsa yozadi (bir musobaqada FAQAT BIR MARTA). */
  async awardBonuses(
    tournamentId: string,
    opts: { apply: boolean; userId?: string },
  ): Promise<{ k: number; rows: BonusRow[]; applied: boolean }> {
    const { k } = await this.context(tournamentId);
    const places = await this.places(tournamentId);
    // O'yin tugashi bilan avtomatik berilgan bonuslar (matches.service) qayta berilmaydi
    const given = await this.prisma.playerPointsLog.findMany({
      where: { tournamentId, note: { startsWith: BONUS_NOTE } },
      select: { playerId: true },
    });
    const has = new Set(given.map((g) => g.playerId));
    const rows: BonusRow[] = [...places.entries()]
      .filter(([playerId]) => !has.has(playerId))
      .map(([playerId, place]) => ({ playerId, place, bonus: placeBonus(place, k) }))
      .filter((r) => r.bonus > 0)
      .sort((a, b) => a.place - b.place);

    if (!opts.apply) return { k, rows, applied: false };
    if (rows.length === 0) {
      throw new BadRequestException('Bonus allaqachon berilgan (yoki berilishi kerak bo‘lgan o‘yinchi yo‘q)');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const r of rows) {
        await addPlayerPoints(tx, r.playerId, r.bonus);
        await tx.playerPointsLog.create({
          data: {
            playerId: r.playerId,
            delta: r.bonus,
            reason: 'ADJUSTMENT',
            tournamentId,
            note: `${BONUS_NOTE} (${r.place}-o'rin)`,
            createdById: opts.userId ?? null,
          },
        });
      }
    });
    return { k, rows, applied: true };
  }

  /**
   * Nizom 28-band: sportchini reyting tizimidan chiqarish (INACTIVE — reyting ro'yxatida ko'rinmaydi va
   * o'yinlarda ball olmaydi/yo'qotmaydi). Sabab MAJBURIY va jurnalga yoziladi.
   */
  async exclude(playerId: string, reason: string, userId: string) {
    const p = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true, status: true } });
    if (!p) throw new NotFoundException("O'yinchi topilmadi");
    await this.prisma.$transaction([
      this.prisma.player.update({ where: { id: playerId }, data: { status: 'INACTIVE' } }),
      this.prisma.playerPointsLog.create({
        data: { playerId, delta: 0, reason: 'ADJUSTMENT', note: `Nizom 28: reytingdan chiqarildi — ${reason}`.slice(0, 250), createdById: userId },
      }),
    ]);
    return { playerId, status: 'INACTIVE' as const };
  }

  async restore(playerId: string, userId: string) {
    const p = await this.prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
    if (!p) throw new NotFoundException("O'yinchi topilmadi");
    await this.prisma.$transaction([
      this.prisma.player.update({ where: { id: playerId }, data: { status: 'ACTIVE' } }),
      this.prisma.playerPointsLog.create({
        data: { playerId, delta: 0, reason: 'ADJUSTMENT', note: 'Nizom 28: reyting tizimiga qaytarildi', createdById: userId },
      }),
    ]);
    return { playerId, status: 'ACTIVE' as const };
  }

  /**
   * 28-band: so'nggi N yil (standart 2) davomida rating musobaqalarida qatnashmagan faol sportchilar —
   * Ijroiya qo'mitasi qaroriga nomzodlar ro'yxati (avtomatik chiqarilmaydi).
   */
  async inactiveCandidates(years = 2) {
    const y = Math.min(10, Math.max(1, Math.floor(years)));
    return this.prisma.$queryRaw<
      Array<{ id: string; firstName: string; lastName: string; region: string; points: number; lastMatch: Date | null }>
    >`
      SELECT p.id, p."first_name" AS "firstName", p."last_name" AS "lastName", p.region,
             p."ranking_points" AS points,
             (SELECT MAX(m."updated_at") FROM matches m
               WHERE m.status = 'FINISHED' AND (m."player1_id" = p.id OR m."player2_id" = p.id)) AS "lastMatch"
        FROM players p
       WHERE p.status = 'ACTIVE'
         AND p."created_at" < NOW() - (${y} * INTERVAL '1 year')
         AND NOT EXISTS (SELECT 1 FROM matches m
               WHERE m.status = 'FINISHED' AND (m."player1_id" = p.id OR m."player2_id" = p.id)
                 AND m."updated_at" >= NOW() - (${y} * INTERVAL '1 year'))
       ORDER BY p."ranking_points" DESC
       LIMIT 500`;
  }

  /** Hakam taqdimnomasi bo'yicha jarima (Ж): K ga mos jadval miqdori. */
  async penalize(
    tournamentId: string,
    playerId: string,
    userId: string,
    reason: string,
  ): Promise<{ penalty: number }> {
    const { k } = await this.context(tournamentId);
    const penalty = penaltyPoints(k);
    await this.prisma.$transaction(async (tx) => {
      await addPlayerPoints(tx, playerId, -penalty);
      await tx.playerPointsLog.create({
        data: {
          playerId,
          delta: -penalty,
          reason: 'ADJUSTMENT',
          tournamentId,
          note: `${PENALTY_NOTE}: ${reason}`.slice(0, 200),
          createdById: userId,
        },
      });
    });
    return { penalty };
  }
}
