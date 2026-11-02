import { regionShort } from '../../common/regions';
import { Injectable, BadRequestException,
  NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ageFromBirthDate,
  parseTables,
  type MatchProfiles,
  type MatchRatingResult,
  type ProfileCard,
  type RatingChange,
} from './showcase.types';

/** Ommaviy endpoint uchun O'YINCHI maydonlari. birthDate faqat yoshni hisoblash uchun o'qiladi va HECH QACHON qaytarilmaydi. */
const PLAYER_SELECT = {
  id: true,
  slug: true,
  firstName: true,
  lastName: true,
  gender: true,
  birthDate: true,
  region: true,
  club: true,
  rankingPoints: true,
  photoUrl: true,
  countryCode: true,
} satisfies Prisma.PlayerSelect;
type PlayerRow = Prisma.PlayerGetPayload<{ select: typeof PLAYER_SELECT }>;

const MATCH_SELECT = {
  id: true,
  status: true,
  stage: true,
  tableNumber: true,
  winnerId: true,
  player1SetsWon: true,
  player2SetsWon: true,
  player1: { select: PLAYER_SELECT },
  player2: { select: PLAYER_SELECT },
  tournament: { select: { name: true } },
  sets: {
    select: { setNumber: true, p1Points: true, p2Points: true },
    orderBy: { setNumber: 'asc' as const },
  },
} satisfies Prisma.MatchSelect;

interface CacheEntry<T> {
  at: number;
  value: T;
}

@Injectable()
export class ShowcaseService {
  /** Yuzlab tomoshabin/overlay bir vaqtda so'raganda bazani urmaslik uchun qisqa muddatli kesh */
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  private async cached<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = this.cache.get(key) as CacheEntry<T> | undefined;
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = await load();
    this.cache.set(key, { at: Date.now(), value });
    if (this.cache.size > 500) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return value;
  }

  /** O'yin keshini tozalash (masalan, Telegram natijasi — undo'dan keyin eski natija olinmasin) */
  forget(matchId: string): void {
    this.cache.delete(`rating:${matchId}`);
    this.cache.delete(`profiles:${matchId}`);
  }

  /** O'yin boshida ko'rsatiladigan o'yinchi kartochkalari (rasm, reyting, o'rin, yosh, hudud, statistika) */
  async profiles(matchId: string): Promise<MatchProfiles> {
    return this.cached(`profiles:${matchId}`, 10_000, async () => {
      const m = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: MATCH_SELECT,
      });
      if (!m) throw new NotFoundException("O'yin topilmadi");
      const players: ProfileCard[] = [];
      for (const [i, p] of [m.player1, m.player2].entries()) {
        if (p) players.push(await this.card(p, (i + 1) as 1 | 2));
      }
      return {
        matchId: m.id,
        tableNumber: m.tableNumber,
        stage: m.stage,
        tournamentName: m.tournament.name,
        players,
      };
    });
  }

  private async card(p: PlayerRow, slot: 1 | 2): Promise<ProfileCard> {
    const [played, won, higher] = await Promise.all([
      this.prisma.match.count({
        where: {
          status: 'FINISHED',
          OR: [{ player1Id: p.id }, { player2Id: p.id }],
        },
      }),
      this.prisma.match.count({
        where: { status: 'FINISHED', winnerId: p.id },
      }),
      this.higherCount(p.gender, p.rankingPoints, p.id),
    ]);
    return {
      slot,
      id: p.id,
      slug: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      countryCode: p.countryCode,
      photoUrl: p.photoUrl,
      // Sahna kartochkasiga sig'adigan qisqa o'zbekcha nom ("Farg'ona", "Qoraqalpog'iston")
      region: regionShort(p.region),
      club: p.club,
      age: ageFromBirthDate(p.birthDate),
      rating: p.rankingPoints,
      rank: higher + 1,
      played,
      won,
      lost: Math.max(0, played - won),
    };
  }

  /** Shu jinsdagi, reytingi belgilangan balldan YUQORI o'yinchilar soni (o'zi hisobga olinmaydi) */
  private higherCount(
    gender: PlayerRow['gender'],
    points: number,
    selfId: string,
  ) {
    return this.prisma.player.count({
      where: {
        gender,
        status: 'ACTIVE',
        rankingPoints: { gt: points },
        id: { not: selfId },
      },
    });
  }

  /** O'yin tugagach: reyting o'zgarishi (oldin -> keyin, +/- ball, o'rin o'zgarishi) */
  async rating(matchId: string): Promise<MatchRatingResult> {
    return this.cached(`rating:${matchId}`, 15_000, async () => {
      const m = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: MATCH_SELECT,
      });
      if (!m) throw new NotFoundException("O'yin topilmadi");
      if (m.status !== 'FINISHED') {
        throw new NotFoundException("O'yin hali tugamagan");
      }
      const ids = [m.player1?.id, m.player2?.id].filter(
        (x): x is string => !!x,
      );
      const logs = await this.prisma.playerPointsLog.groupBy({
        by: ['playerId'],
        where: { matchId, playerId: { in: ids } },
        _sum: { delta: true },
      });
      const deltaOf = new Map(logs.map((l) => [l.playerId, l._sum.delta ?? 0]));

      const players: RatingChange[] = [];
      for (const [i, p] of [m.player1, m.player2].entries()) {
        if (!p) continue;
        const delta = deltaOf.get(p.id) ?? 0;
        // Ball o'yin tugaganda jurnalga yozilgan va Player.rankingPoints'ga allaqachon qo'shilgan
        const after = p.rankingPoints;
        const before = after - delta;
        const [hAfter, hBefore] = await Promise.all([
          this.higherCount(p.gender, after, p.id),
          this.higherCount(p.gender, before, p.id),
        ]);
        players.push({
          slot: (i + 1) as 1 | 2,
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          countryCode: p.countryCode,
          photoUrl: p.photoUrl,
          won: m.winnerId === p.id,
          sets: i === 0 ? m.player1SetsWon : m.player2SetsWon,
          before,
          after,
          delta,
          rankBefore: hBefore + 1,
          rankAfter: hAfter + 1,
        });
      }
      return {
        matchId: m.id,
        tableNumber: m.tableNumber,
        stage: m.stage,
        tournamentName: m.tournament.name,
        games: m.sets.map((s) => [s.p1Points, s.p2Points] as [number, number]),
        winnerSlot:
          m.winnerId && m.player1?.id === m.winnerId
            ? 1
            : m.winnerId && m.player2?.id === m.winnerId
              ? 2
              : null,
        players,
      };
    });
  }

  // ==================== REKLAMA ====================

  /** Overlay uchun: yoqilgan reklamalar (stol bo'yicha filtr) */
  async publicAds(tableNumber?: number) {
    const rows = await this.cached('ads:public', 5_000, () =>
      this.prisma.overlayAd.findMany({
        where: { enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
    return rows
      .filter((a) => {
        const t = parseTables(a.tables);
        return !t || tableNumber === undefined || t.includes(tableNumber);
      })
      .map((a) => ({
        id: a.id,
        title: a.title,
        kind: a.kind,
        imageUrl: a.imageUrl,
        videoUrl: a.videoUrl,
        durationS: a.durationS,
      }));
  }

  adminAds() {
    return this.prisma.overlayAd.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createAd(data: {
    title: string;
    kind?: 'IMAGE' | 'VIDEO' | 'PROMO';
    imageUrl?: string;
    videoUrl?: string;
    durationS?: number;
    tables?: string;
  }) {
    const kind = data.kind ?? 'IMAGE';
    // Davomiylik chegaralari: rasm va qisqa reklama ≤ 15 s (odatda 8–10), promo ≤ 30 s
    const max = kind === 'PROMO' ? 30 : 15;
    const durationS = data.durationS ?? (kind === 'PROMO' ? 30 : 10);
    if (durationS > max) throw new BadRequestException(`Bu tur uchun davomiylik ${max} soniyadan oshmasin`);
    if (kind === 'IMAGE' && !data.imageUrl) throw new BadRequestException('Rasm kiritilmadi');
    if (kind !== 'IMAGE' && !data.videoUrl) throw new BadRequestException('Rolik kiritilmadi');
    const last = await this.prisma.overlayAd.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    this.cache.delete('ads:public');
    return this.prisma.overlayAd.create({
      data: {
        title: data.title,
        kind,
        imageUrl: data.imageUrl ?? null,
        videoUrl: kind === 'IMAGE' ? null : data.videoUrl,
        durationS,
        tables: data.tables ?? '',
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateAd(
    id: string,
    data: {
      title?: string;
      durationS?: number;
      tables?: string;
      enabled?: boolean;
      sortOrder?: number;
    },
  ) {
    this.cache.delete('ads:public');
    if (data.durationS !== undefined) {
      const ad = await this.prisma.overlayAd.findUnique({ where: { id }, select: { kind: true } });
      if (ad && data.durationS > (ad.kind === 'PROMO' ? 30 : 15)) {
        throw new BadRequestException(`Bu tur uchun davomiylik ${ad.kind === 'PROMO' ? 30 : 15} soniyadan oshmasin`);
      }
    }
    try {
      return await this.prisma.overlayAd.update({ where: { id }, data });
    } catch {
      throw new NotFoundException('Reklama topilmadi');
    }
  }

  async deleteAd(id: string) {
    this.cache.delete('ads:public');
    try {
      await this.prisma.overlayAd.delete({ where: { id } });
    } catch {
      throw new NotFoundException('Reklama topilmadi');
    }
    return { ok: true };
  }

  // ==================== BO'SH VAQT AYLANMASI ====================

  /**
   * Stoldagi o'yin tugagach TV/overlay'da aylanadigan ma'lumot: oxirgi natijalar, navbatdagi o'yinlar,
   * guruhli kategoriyalar. Musobaqa — shu stoldagi eng oxirgi o'yinniki. 5 soniya kesh: ko'p ekran bazani urmasin.
   */
  async idleFeed(tableNumber: number) {
    return this.cached(`idle:${tableNumber}`, 5_000, async () => {
      // Shu stoldagi oxirgi o'yin; stolda o'yin bo'lmasa — eng oxirgi faol musobaqa
      const last =
        (await this.prisma.match.findFirst({ where: { tableNumber }, orderBy: [{ updatedAt: 'desc' }], select: { tournamentId: true } })) ??
        (await this.prisma.match.findFirst({ orderBy: [{ updatedAt: 'desc' }], select: { tournamentId: true } }));
      if (!last) return { tournament: null, results: [], upcoming: [], groupCategories: [] };
      const tournamentId = last.tournamentId;
      const person = { select: { firstName: true, lastName: true, photoUrl: true } } as const;
      const staff = { select: { firstName: true, lastName: true } } as const;
      const base = {
        id: true, stage: true, tableNumber: true, scheduledAt: true, player1SetsWon: true, player2SetsWon: true,
        winnerId: true, player1Id: true, player2Id: true, player1: person, player2: person, referee: staff, assistant: staff,
      } as const;
      const [tournament, finished, upcoming, groups] = await Promise.all([
        this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { name: true } }),
        this.prisma.match.findMany({ where: { tournamentId, status: 'FINISHED' }, orderBy: { updatedAt: 'desc' }, take: 8, select: base }),
        this.prisma.match.findMany({
          where: { tournamentId, status: 'SCHEDULED', player1Id: { not: null }, player2Id: { not: null } },
          orderBy: [{ scheduledAt: 'asc' }, { tableNumber: 'asc' }],
          take: 8,
          select: base,
        }),
        this.prisma.groupStage.findMany({
          where: { category: { tournamentId } },
          select: { tournamentCategoryId: true, category: { select: { ageCategory: { select: { code: true } }, gender: true } } },
        }),
      ]);
      const nm = (p: { firstName: string; lastName: string } | null) => (p ? `${p.firstName[0]}. ${p.lastName}` : '—');
      const shape = (m: (typeof finished)[number]) => ({
        id: m.id, stage: m.stage, table: m.tableNumber, at: m.scheduledAt,
        p1: { name: nm(m.player1), photoUrl: m.player1?.photoUrl ?? null, sets: m.player1SetsWon, won: m.winnerId === m.player1Id },
        p2: { name: nm(m.player2), photoUrl: m.player2?.photoUrl ?? null, sets: m.player2SetsWon, won: m.winnerId === m.player2Id },
        referee: m.referee ? nm(m.referee) : null,
        assistant: m.assistant ? nm(m.assistant) : null,
      });
      return {
        tournament: tournament?.name ?? null,
        results: finished.map(shape),
        upcoming: upcoming.map(shape),
        groupCategories: groups.map((g) => ({ id: g.tournamentCategoryId, label: `${g.category.ageCategory.code} ${g.category.gender === 'MALE' ? '♂' : '♀'}` })),
      };
    });
  }
}
