import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../showcase/telegram.service';
import { AssignmentService } from '../referee-assignment/assignment.service';
import { DrawsService } from './draws.service';
import {
  groupStandings,
  placeQualifiers,
  roundRobinRounds,
  snakeDraw,
  type GroupMatchResult,
  type Qualifier,
} from './groups.engine';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly draws: DrawsService,
    private readonly assignment: AssignmentService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Qurani TIZIMNING O'ZI o'tkazadi (admin faqat tugmani bosadi): tasdiqlangan o'yinchilar soniga qarab
   * format tanlanadi va reyting bo'yicha qura (zmeyka / seedlar) bajariladi.
   *  - 2..8 o'yinchi: to'g'ridan-to'g'ri setka (olimpiya tizimi)
   *  - 9+ o'yinchi: guruhlar (har guruhda kamida 3 ta, guruhlar soni 2 ning darajasi), har guruhdan 2 tadan setkaga
   */
  async auto(categoryId: string) {
    const category = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoryId },
      include: {
        draws: { select: { id: true } },
        groupStage: { select: { id: true } },
        _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } },
      },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.groupStage || category.draws.length > 0) {
      throw new ConflictException('Bu kategoriya uchun qura allaqachon o\'tkazilgan');
    }
    const n = category._count.registrations;
    if (n < 2) throw new BadRequestException('Qura uchun kamida 2 ta tasdiqlangan o\'yinchi kerak');
    if (n <= 8) {
      const draw = await this.draws.generate(categoryId);
      return { format: 'BRACKET' as const, players: n, groupCount: 0, advancing: 0, draw };
    }
    let groupCount = 1;
    while (groupCount * 2 <= 32 && Math.floor(n / (groupCount * 2)) >= 3) groupCount *= 2;
    const stage = await this.create(categoryId, { groupCount, advancing: 2, bestOf: 5 });
    return { format: 'GROUPS' as const, players: n, groupCount, advancing: 2, stage };
  }

  /** Guruh bosqichini yaratadi: zmeyka bilan taqsimlash + doira tizimi o'yinlari (4.7.2, 4.5.4.6). */
  async create(
    categoryId: string,
    dto: { groupCount: number; advancing: number; bestOf?: number; modifiedSnake?: boolean },
  ) {
    const category = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoryId },
      include: {
        draws: { select: { id: true } },
        groupStage: { select: { id: true } },
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            player: { select: { id: true, rankingPoints: true, region: true } },
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.groupStage) throw new ConflictException('Bu kategoriya uchun guruhlar allaqachon yaratilgan');
    if (category.draws.length > 0) throw new ConflictException('Setka allaqachon yaratilgan');

    const players = category.registrations.map((r) => ({
      playerId: r.player.id,
      rating: r.player.rankingPoints,
      org: r.player.region,
    }));
    const G = dto.groupCount;
    if (players.length < G * 2) {
      throw new BadRequestException(`Har guruhda kamida 2 o'yinchi bo'lishi uchun ${G * 2} ta tasdiqlangan o'yinchi kerak (hozir ${players.length})`);
    }
    const groups = snakeDraw(players, G, { modified: dto.modifiedSnake });
    const minSize = Math.min(...groups.map((g) => g.length));
    if (dto.advancing < 1 || dto.advancing >= minSize) {
      throw new BadRequestException(`Har guruhdan chiqadiganlar soni 1 dan ${minSize - 1} gacha bo'lishi kerak`);
    }
    const bestOf = dto.bestOf ?? 5;
    if (![3, 5, 7].includes(bestOf)) throw new BadRequestException('bestOf 3, 5 yoki 7');

    await this.prisma.$transaction(async (tx) => {
      const stage = await tx.groupStage.create({
        data: { tournamentCategoryId: categoryId, groupCount: G, advancing: dto.advancing, bestOf },
      });
      for (let gi = 0; gi < groups.length; gi++) {
        const grp = await tx.tournamentGroup.create({ data: { stageId: stage.id, number: gi + 1 } });
        await tx.groupEntry.createMany({
          data: groups[gi].map((p, i) => ({ groupId: grp.id, playerId: p.playerId, position: i + 1 })),
        });
        const rounds = roundRobinRounds(groups[gi].length);
        for (let r = 0; r < rounds.length; r++) {
          for (const [a, b] of rounds[r]) {
            await tx.match.create({
              data: {
                tournamentId: category.tournamentId,
                stage: 'GROUP',
                groupId: grp.id,
                groupRound: r + 1,
                bestOf,
                player1Id: groups[gi][a - 1].playerId,
                player2Id: groups[gi][b - 1].playerId,
                refereeCodeHash: createHash('sha256')
                  .update(String(Math.floor(100000 + Math.random() * 900000)))
                  .digest('hex'),
              },
            });
          }
        }
      }
    });
    // Guruh o'yinlari yaratildi — hakamlar avtomatik tayinlanadi (xato bo'lsa ham guruhlar saqlanadi)
    await this.assignment.autoAssign(category.tournamentId);
    this.telegram.announceDraw(categoryId, 'groups');
    return this.view(categoryId);
  }

  /** Guruhlar, a'zolar va jadval (hisob 4.2.1–4.2.7 bo'yicha) */
  async view(categoryId: string) {
    const stage = await this.prisma.groupStage.findUnique({
      where: { tournamentCategoryId: categoryId },
      include: {
        groups: {
          orderBy: { number: 'asc' },
          include: {
            entries: {
              orderBy: { position: 'asc' },
              include: {
                player: {
                  select: { id: true, slug: true, firstName: true, lastName: true, region: true, photoUrl: true, rankingPoints: true },
                },
              },
            },
            matches: {
              orderBy: [{ groupRound: 'asc' }, { createdAt: 'asc' }],
              include: { sets: { orderBy: { setNumber: 'asc' } } },
            },
          },
        },
      },
    });
    if (!stage) throw new NotFoundException('Bu kategoriyada guruh bosqichi yo\'q');

    const allDone = stage.groups.every((g) => g.matches.every((m) => m.status === 'FINISHED'));
    return {
      id: stage.id,
      status: stage.status,
      groupCount: stage.groupCount,
      advancing: stage.advancing,
      bestOf: stage.bestOf,
      allMatchesFinished: allDone,
      bracketPlan: this.bracketPlan(categoryId, stage.groupCount, stage.advancing),
      groups: stage.groups.map((g) => {
        const ids = g.entries.map((e) => e.playerId);
        const results = g.matches.map((m) => this.toResult(m));
        const standings = groupStandings(ids, results, Math.random, { final: allDone });
        const byId = new Map(g.entries.map((e) => [e.playerId, e.player]));
        return {
          number: g.number,
          standings: standings.map((s) => ({ ...s, player: byId.get(s.playerId) })),
          matches: g.matches.map((m) => ({
            id: m.id,
            round: m.groupRound,
            status: m.status,
            player1Id: m.player1Id,
            player2Id: m.player2Id,
            winnerId: m.winnerId,
            setsP1: m.player1SetsWon,
            setsP2: m.player2SetsWon,
            games: m.sets.map((s) => [s.p1Points, s.p2Points]),
            tableNumber: m.tableNumber,
          })),
        };
      }),
    };
  }

  /** Guruh harfi: 1→A, 2→B ... (26 dan oshsa G27 ko'rinishida) */
  private static groupLetter(n: number) {
    return n <= 26 ? String.fromCharCode(64 + n) : `G${n}`;
  }

  /**
   * Setka REJASI: guruh natijalari hali yo'q bo'lsa ham "A1 — C2" ko'rinishida aniq juftliklar.
   * Jereb kategoriya identifikatoridan olinadi, shuning uchun reja har safar bir xil bo'ladi va
   * guruhlar tugagach haqiqiy setka aynan shu joylashuv bo'yicha to'ldiriladi.
   */
  bracketPlan(categoryId: string, groupCount: number, advancing: number) {
    const qs: Qualifier[] = [];
    for (let g = 1; g <= groupCount; g++) {
      for (let p = 1; p <= advancing; p++) {
        qs.push({ playerId: `${GroupsService.groupLetter(g)}${p}`, group: g, place: p });
      }
    }
    let a = createHash('sha1').update(categoryId).digest().readUInt32LE(0);
    const rng = () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const slots = placeQualifiers(qs, groupCount, rng);
    const firstRound: Array<{ n: number; a: string | null; b: string | null }> = [];
    for (let i = 0; i < slots.length; i += 2) firstRound.push({ n: i / 2 + 1, a: slots[i], b: slots[i + 1] });
    return { size: slots.length, slots, firstRound };
  }

  private toResult(m: {
    player1Id: string | null;
    player2Id: string | null;
    status: string;
    winnerId: string | null;
    disqualifiedPlayerId: string | null;
    currentSetP1: number;
    currentSetP2: number;
    bestOf: number;
    sets: Array<{ p1Points: number; p2Points: number }>;
  }): GroupMatchResult {
    const a = m.player1Id ?? '';
    const b = m.player2Id ?? '';
    const sets = m.sets.map((s) => ({ a: s.p1Points, b: s.p2Points }));
    if (m.status !== 'FINISHED' || !m.winnerId) return { a, b, kind: 'NONE', bestOf: m.bestOf };
    if (m.disqualifiedPlayerId) {
      return {
        a, b, kind: 'FORFEIT', winner: m.winnerId, sets, bestOf: m.bestOf,
        partial: m.currentSetP1 + m.currentSetP2 > 0 ? { a: m.currentSetP1, b: m.currentSetP2 } : null,
      };
    }
    return { a, b, kind: 'PLAYED', winner: m.winnerId, sets, bestOf: m.bestOf };
  }

  /**
   * Guruhdan setkaga (4.7.3). Barcha guruh o'yinlari tugagan bo'lishi kerak (yoki `force`).
   * Joylashtirish qoidalari — `placeQualifiers`; bo'sh joylar — 28-ilova.
   */
  async advance(categoryId: string, opts: { force?: boolean } = {}) {
    const category = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, tournamentId: true },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    const view = await this.view(categoryId);
    if (view.status === 'ADVANCED') throw new ConflictException("Setka allaqachon yaratilgan");
    if (!view.allMatchesFinished && !opts.force) {
      throw new BadRequestException("Guruh o'yinlari hali tugamagan");
    }
    // Faqat jereb talab qiladigan tenglik qolmaganini tekshiramiz (4.2.4: jereb tashlanadi — bu hakam ishi)
    const qualifiers: Qualifier[] = [];
    for (const g of view.groups) {
      for (const s of g.standings) {
        if (s.annulled) continue;
        if (s.place <= view.advancing) {
          qualifiers.push({ playerId: s.playerId, group: g.number, place: s.place, org: s.player?.region });
        }
      }
    }
    if (qualifiers.length < 2) throw new BadRequestException('Setka uchun kamida 2 ta o\'yinchi kerak');
    // Setka rejasi (A1—C2 ...) bo'yicha joylashtiramiz: yorliq → haqiqiy o'yinchi
    const labelOf = (q: Qualifier) => `${GroupsService.groupLetter(q.group)}${q.place}`;
    const byLabel = new Map(qualifiers.map((q) => [labelOf(q), q]));
    const plan = this.bracketPlan(categoryId, view.groupCount, view.advancing);
    const slots = plan.slots.map((label, i) => {
      const q = label ? byLabel.get(label) : undefined;
      return { position: i + 1, seed: q && q.place === 1 ? q.group : null, playerId: q ? q.playerId : null };
    });
    const draw = await this.draws.persistSlots(categoryId, category.tournamentId, slots);
    await this.prisma.groupStage.update({ where: { id: view.id }, data: { status: 'ADVANCED' } });
    return draw;
  }
}
