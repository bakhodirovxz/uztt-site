import { BadRequestException, ConflictException, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { MatchStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchesService } from '../matches/matches.service';
import { tournamentK } from '../rankings/rating.engine';
import { planReplay } from './replay-plan';
import type { SbLiveDto } from './dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STAGE_LABEL: Record<string, string> = {
  GROUP: 'GROUP STAGE',
  ROUND_1: 'ROUND 1',
  ROUND_OF_32: 'ROUND OF 32',
  ROUND_OF_16: 'ROUND OF 16',
  QUARTERFINAL: 'QUARTERFINAL',
  SEMIFINAL: 'SEMIFINAL',
  THIRD_PLACE: '3RD PLACE',
  FINAL: 'FINAL',
};

/**
 * Tayyor "scoreboard" dasturi (planshet / TV / overlay) bilan ko'prik:
 *  - export: ayni paytdagi musobaqaning o'yinlari scoreboard qura ro'yxati ko'rinishida;
 *  - result: scoreboard'da tugagan o'yin natijasi (geymlar hisobi) sayt bazasiga yoziladi.
 * Natija sayt qoidalari bo'yicha ochko-ochko qayta o'ynaladi, shuning uchun guruh jadvali, setka,
 * reyting, hakamlar va boshqa barcha hodisalar odatdagidek ishlaydi.
 */
@Injectable()
export class ScoreboardBridgeService {
  private readonly log = new Logger(ScoreboardBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matches: MatchesService,
  ) {}

  async export() {
    const ids = await this.matches.currentTournamentIds();
    const rows = await this.prisma.match.findMany({
      where: { tournamentId: { in: ids }, player1Id: { not: null }, player2Id: { not: null } },
      orderBy: [{ tableNumber: { sort: 'asc', nulls: 'last' } }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        tournament: {
          select: {
            name: true,
            level: { select: { ratingK: true } },
            ageCategory: { select: { code: true } },
          },
        },
        player1: { select: { firstName: true, lastName: true } },
        player2: { select: { firstName: true, lastName: true } },
      },
    });
    const p = (x: { firstName: string; lastName: string } | null) => ({
      name: (x?.lastName ?? '').toUpperCase(),
      given: x?.firstName ?? '',
      country: 'UZB',
    });
    return {
      players: [] as unknown[],
      matches: rows.map((m) => ({
        siteId: m.id,
        table: m.tableNumber ? String(m.tableNumber) : '',
        category: m.tournament.name.toUpperCase(),
        round: STAGE_LABEL[m.stage as MatchStage] ?? String(m.stage),
        bestOf: m.bestOf,
        k: tournamentK(m.tournament.level.ratingK, m.tournament.ageCategory?.code),
        p: [p(m.player1), p(m.player2)],
        done: m.status === 'FINISHED',
        verified: !!m.refereeVerifiedAt,
      })),
    };
  }

  /** Planshetlardagi jonli hisob: saytning jonli ro'yxati va ekranlari ko'rsatadi, bazaga yozilmaydi */
  async setLive(list: SbLiveDto['matches']) {
    const int = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 1000 ? (v as number) : 0);
    const pair = (p: unknown): [number, number] => (Array.isArray(p) ? [int(p[0]), int(p[1])] : [0, 0]);
    await this.matches.setBoardStates(
      list
        .filter((m) => typeof m?.siteId === 'string' && UUID.test(m.siteId))
        .map((m) => ({
          siteId: m.siteId,
          court: String(m.court ?? '').slice(0, 8),
          points: pair(m.points),
          setsWon: pair(m.setsWon),
          sets: (Array.isArray(m.sets) ? m.sets.slice(0, 9) : []).map(pair),
        })),
    );
  }

  /**
   * Scoreboard'da tugagan o'yin: geymlar hisobi [[11,7],[9,11],...] — sayt qoidalari bo'yicha qayta o'ynaladi.
   * Avval to'liq OLDINDAN o'ynab ko'riladi (planReplay): o'yin sayt qoidalari bo'yicha aynan oxirgi ochkoda
   * tugamasa — 422, bazaga hech narsa yozilmaydi (yarim qolgan o'yin paydo bo'lmasin).
   */
  async applyResult(siteId: string, sets: Array<[number, number]>, userId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: siteId } });
    if (!match) throw new BadRequestException("O'yin topilmadi");
    if (match.status === 'FINISHED') return { ok: true, already: true, finished: true };
    if (!match.player1Id || !match.player2Id) throw new BadRequestException("O'yinchilar belgilanmagan");

    const plan = planReplay(sets, match.bestOf);
    if (!plan.ok) {
      throw new UnprocessableEntityException(
        `Natija saytga yozilmadi: ${plan.reason}. O'yin natijasini saytda qo'lda kiriting.`,
      );
    }

    const done = await this.prisma.matchSet.count({ where: { matchId: siteId } });
    if (done > 0 || match.currentSetP1 + match.currentSetP2 > 0) {
      throw new ConflictException("Bu o'yin saytda allaqachon boshlangan (ochkolar bor) — natijani qo'lda kiriting");
    }
    if (!match.refereeVerifiedAt) {
      await this.prisma.match.update({
        where: { id: siteId },
        data: { refereeVerifiedAt: new Date(), verifiedByUserId: userId },
      });
    }
    // Eslatma: har ochko alohida tranzaksiya (MatchesService.point). Oldindan tekshiruv tufayli
    // qoidaga zid natija yozilmaydi; to'liq atomiklik uchun MatchesService'da tx qabul qiluvchi usul kerak.
    let n = 0;
    for (const slot of plan.order) {
      // Bridge SUPERADMIN nomidan yozadi — tayinlangan hakam emas, shuning uchun menejer sifatida
      await this.matches.point(siteId, slot, userId, true);
      n++;
    }
    const after = await this.prisma.match.findUnique({ where: { id: siteId }, select: { status: true } });
    const finished = after?.status === 'FINISHED';
    if (finished) this.log.log(`Scoreboard natijasi yozildi: ${siteId} (${n} ochko)`);
    else this.log.warn(`Scoreboard natijasi: ${siteId} — ${n} ochko yozildi, lekin o'yin tugamadi`);
    return { ok: finished, points: n, finished };
  }
}
