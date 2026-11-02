import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { MatchStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchesService } from '../matches/matches.service';

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
        tournament: { select: { name: true } },
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
        p: [p(m.player1), p(m.player2)],
        done: m.status === 'FINISHED',
      })),
    };
  }

  /** Scoreboard'da tugagan o'yin: geymlar hisobi [[11,7],[9,11],...] — sayt qoidalari bo'yicha qayta o'ynaladi */
  async applyResult(siteId: string, sets: Array<[number, number]>, userId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: siteId } });
    if (!match) throw new BadRequestException("O'yin topilmadi");
    if (match.status === 'FINISHED') return { already: true };
    if (!match.player1Id || !match.player2Id) throw new BadRequestException("O'yinchilar belgilanmagan");
    for (const s of sets) {
      if (!Array.isArray(s) || s.length !== 2 || s.some((v) => !Number.isInteger(v) || v < 0 || v > 60)) {
        throw new BadRequestException("Geym hisobi noto'g'ri");
      }
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
    let n = 0;
    for (const [a, b] of sets) {
      const lo = Math.min(a, b);
      const order: Array<1 | 2> = [];
      for (let i = 0; i < lo; i++) order.push(1, 2);
      const winner: 1 | 2 = a > b ? 1 : 2;
      for (let i = 0; i < Math.abs(a - b); i++) order.push(winner);
      for (const slot of order) {
        const cur = await this.prisma.match.findUnique({ where: { id: siteId }, select: { status: true } });
        if (cur?.status === 'FINISHED') break;
        await this.matches.point(siteId, slot, userId);
        n++;
      }
    }
    this.log.log(`Scoreboard natijasi yozildi: ${siteId} (${n} ochko)`);
    const after = await this.prisma.match.findUnique({ where: { id: siteId }, select: { status: true } });
    return { ok: true, points: n, finished: after?.status === 'FINISHED' };
  }
}
