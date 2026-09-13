import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isoWeekLabel, movementOf, rankWithin } from './ranking.util';

interface ListFilter {
  gender?: Gender;
  ageCategory?: string;
  /** Kesim yorlig'i yoki id — berilsa, tarixiy jadval qaytadi */
  snapshot?: string;
  /** Sahifalash — 1-dan boshlanadi */
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function paginate<T>(all: T[], page: number, pageSize: number): PagedResult<T> {
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: all.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

const PLAYER_SELECT = {
  id: true,
  slug: true,
  firstName: true,
  lastName: true,
  gender: true,
  region: true,
  club: true,
  rankingPoints: true,
  photoUrl: true,
  ageCategory: { select: { code: true, name: true } },
} as const;

@Injectable()
export class RankingsService {
  private readonly logger = new Logger(RankingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reyting jadvali. Kesim ko'rsatilmasa — joriy holat, ▲▼ oxirgi kesimga nisbatan.
   * Kesim ko'rsatilsa — o'sha kesimdagi holat, ▲▼ undan oldingi kesimga nisbatan.
   */
  async list(filter: ListFilter) {
    const ageCategoryId = filter.ageCategory
      ? ((
          await this.prisma.ageCategory.findUnique({
            where: { code: filter.ageCategory },
            select: { id: true },
          })
        )?.id ?? null)
      : undefined;
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const pageSize = filter.pageSize
      ? Math.min(Math.max(1, filter.pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    // Mavjud bo'lmagan toifa so'ralsa — bo'sh ro'yxat (xato emas)
    if (ageCategoryId === null) return paginate([], page, pageSize);

    const all = filter.snapshot
      ? await this.historicalList(filter.snapshot, filter.gender, ageCategoryId)
      : await this.currentList(filter.gender, filter.ageCategory, ageCategoryId);

    return paginate(all, page, pageSize);
  }

  private async currentList(
    gender: Gender | undefined,
    ageCategoryCode: string | undefined,
    ageCategoryId: string | undefined,
  ) {
    const players = await this.prisma.player.findMany({
      where: {
        status: 'ACTIVE',
        gender,
        ageCategory: ageCategoryCode ? { code: ageCategoryCode } : undefined,
      },
      orderBy: [{ rankingPoints: 'desc' }, { lastName: 'asc' }],
      select: PLAYER_SELECT,
    });

    const previous = await this.previousRanks(undefined, gender, ageCategoryId);

    // O'rin qo'yish qoidasi kesimdagi bilan BIR XIL bo'lishi shart: teng ballda
    // teng o'rin. Aks holda jonli jadvalda ketma-ket raqam (32, 33), kesimda
    // esa teng o'rin (32, 32) chiqib, teng ballli o'yinchi hech narsa
    // o'zgarmagan holda "▼1" ko'rinardi (va hech kim ko'tarilmasdi).
    const ranks = rankWithin(
      players.map((p, i) => ({
        playerId: p.id,
        points: p.rankingPoints,
        rank: i + 1,
      })),
    );

    return players
      .map((p) => {
        const rank = ranks.get(p.id)!;
        return {
          rank,
          movement: movementOf(rank, previous.get(p.id)),
          previousRank: previous.get(p.id) ?? null,
          ...p,
        };
      })
      .sort((a, b) => a.rank - b.rank);
  }

  private async historicalList(
    snapshotRef: string,
    gender: Gender | undefined,
    ageCategoryId: string | undefined,
  ) {
    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: { OR: [{ id: snapshotRef }, { label: snapshotRef }] },
      select: { id: true, label: true, takenAt: true },
    });
    if (!snapshot) throw new NotFoundException('Reyting kesimi topilmadi');

    const entries = await this.prisma.rankingSnapshotEntry.findMany({
      where: { snapshotId: snapshot.id, gender, ageCategoryId },
      orderBy: { rank: 'asc' },
      select: {
        playerId: true,
        points: true,
        rank: true,
        player: { select: PLAYER_SELECT },
      },
    });

    const ranks = rankWithin(entries);
    const previous = await this.previousRanks(
      snapshot.takenAt,
      gender,
      ageCategoryId,
    );

    return entries
      .map((e) => {
        const rank = ranks.get(e.playerId)!;
        return {
          rank,
          movement: movementOf(rank, previous.get(e.playerId)),
          previousRank: previous.get(e.playerId) ?? null,
          ...e.player,
          rankingPoints: e.points,
        };
      })
      .sort((a, b) => a.rank - b.rank);
  }

  /**
   * Berilgan sanadan oldingi eng yangi kesimdagi o'rinlar (filtr ichida qayta hisoblangan).
   * `before` berilmasa — umuman oxirgi kesim.
   */
  private async previousRanks(
    before: Date | undefined,
    gender: Gender | undefined,
    ageCategoryId: string | undefined,
  ): Promise<Map<string, number>> {
    const snapshot = await this.prisma.rankingSnapshot.findFirst({
      where: before ? { takenAt: { lt: before } } : {},
      orderBy: { takenAt: 'desc' },
      select: { id: true },
    });
    if (!snapshot) return new Map();

    const entries = await this.prisma.rankingSnapshotEntry.findMany({
      where: { snapshotId: snapshot.id, gender, ageCategoryId },
      select: { playerId: true, points: true, rank: true },
    });
    return rankWithin(entries);
  }

  /** Kesimlar ro'yxati (sana tanlash uchun) */
  async snapshots() {
    const rows = await this.prisma.rankingSnapshot.findMany({
      orderBy: { takenAt: 'desc' },
      take: 60,
      select: {
        id: true,
        label: true,
        takenAt: true,
        isAuto: true,
        _count: { select: { entries: true } },
      },
    });
    return rows.map(({ _count, ...s }) => ({
      ...s,
      entryCount: _count.entries,
    }));
  }

  /**
   * Joriy reytingdan kesim oladi. Bir hafta yorlig'i ikki marta olinsa —
   * eskisi almashtiriladi (cron qayta ishga tushsa dublikat bo'lmaydi).
   */
  async createSnapshot(options: { label?: string; isAuto?: boolean } = {}) {
    const label = options.label?.trim() || isoWeekLabel(new Date());
    const players = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ rankingPoints: 'desc' }, { lastName: 'asc' }],
      select: {
        id: true,
        rankingPoints: true,
        gender: true,
        ageCategoryId: true,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.rankingSnapshot.deleteMany({ where: { label } });
      return tx.rankingSnapshot.create({
        data: {
          label,
          isAuto: options.isAuto ?? false,
          entries: {
            create: players.map((p, i) => ({
              playerId: p.id,
              rank: i + 1,
              points: p.rankingPoints,
              gender: p.gender,
              ageCategoryId: p.ageCategoryId,
            })),
          },
        },
        select: { id: true, label: true, takenAt: true, isAuto: true },
      });
    });
  }

  async removeSnapshot(id: string) {
    const exists = await this.prisma.rankingSnapshot.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Reyting kesimi topilmadi');
    await this.prisma.rankingSnapshot.delete({ where: { id } });
    return { ok: true };
  }

  /** Har dushanba 03:00 da haftalik kesim (WTT reytingi ham haftalik yangilanadi) */
  @Cron('0 3 * * 1', { name: 'weekly-ranking-snapshot' })
  async weeklySnapshot() {
    const snapshot = await this.createSnapshot({ isAuto: true });
    this.logger.log(`Haftalik reyting kesimi olindi: ${snapshot.label}`);
  }

  /**
   * Juftlik ("DOUBLES") yoki Aralash juftlik ("MIXED_DOUBLES") reytingi.
   * Hozircha tarixiy kesim (▲▼) yo'q — faqat joriy holat.
   */
  async listPartnerships(
    category: 'DOUBLES' | 'MIXED_DOUBLES',
    gender?: Gender,
    ageCategoryCode?: string,
    page?: number,
    pageSize?: number,
  ) {
    const ageCategoryId = ageCategoryCode
      ? ((
          await this.prisma.ageCategory.findUnique({
            where: { code: ageCategoryCode },
            select: { id: true },
          })
        )?.id ?? null)
      : undefined;
    const safePage = page && page > 0 ? page : 1;
    const safePageSize = pageSize
      ? Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    if (ageCategoryId === null) return paginate([], safePage, safePageSize);

    const partnerSelect = {
      id: true,
      slug: true,
      firstName: true,
      lastName: true,
      gender: true,
      region: true,
      club: true,
      photoUrl: true,
    } as const;

    const rows = await this.prisma.partnership.findMany({
      where: {
        category,
        ageCategoryId: ageCategoryId ?? undefined,
        // Aralash juftlikda ikkala jins ham qatnashadi — jins filtri faqat
        // bir xil jinsli (DOUBLES) juftlikka ma'noli.
        player1: gender && category === 'DOUBLES' ? { gender } : undefined,
      },
      orderBy: [{ points: 'desc' }],
      select: {
        id: true,
        points: true,
        player1: { select: partnerSelect },
        player2: { select: partnerSelect },
        ageCategory: { select: { code: true, name: true } },
      },
    });

    return paginate(this.withRank(rows), safePage, safePageSize);
  }

  /** Jamoaviy reyting. `gender` "MIXED" bo'lsa — aralash jamoalar. */
  async listTeams(
    gender?: Gender | 'MIXED',
    ageCategoryCode?: string,
    page?: number,
    pageSize?: number,
  ) {
    const ageCategoryId = ageCategoryCode
      ? ((
          await this.prisma.ageCategory.findUnique({
            where: { code: ageCategoryCode },
            select: { id: true },
          })
        )?.id ?? null)
      : undefined;
    const safePage = page && page > 0 ? page : 1;
    const safePageSize = pageSize
      ? Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    if (ageCategoryId === null) return paginate([], safePage, safePageSize);

    const rows = await this.prisma.team.findMany({
      where: {
        ageCategoryId: ageCategoryId ?? undefined,
        gender: gender === 'MIXED' ? null : gender,
      },
      orderBy: [{ points: 'desc' }],
      select: {
        id: true,
        name: true,
        regionName: true,
        districtName: true,
        gender: true,
        points: true,
        ageCategory: { select: { code: true, name: true } },
      },
    });

    return paginate(this.withRank(rows), safePage, safePageSize);
  }

  /** Teng ballda teng o'rin beruvchi umumiy o'rin hisoblagich. */
  private withRank<T extends { points: number }>(
    rows: T[],
  ): (T & { rank: number })[] {
    let lastPoints: number | null = null;
    let lastRank = 0;
    return rows.map((r, i) => {
      const rank = r.points === lastPoints ? lastRank : i + 1;
      lastPoints = r.points;
      lastRank = rank;
      return { ...r, rank };
    });
  }
}
