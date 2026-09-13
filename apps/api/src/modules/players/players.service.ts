import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Gender, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { uniqueViolationTarget } from '../../common/prisma-errors';

// Ommaviy ro'yxat uchun default 100. Yuqori chegara 500 — panel va profil
// sahifalaridagi tanlov ro'yxatlari ilgari aynan take:500 olardi, chegarani
// pasaytirish ularni sindirardi. Maxfiylik chegarani emas, maydonlar
// tarkibini qisqartirish bilan ta'minlanadi (birthDate/districtName chiqarildi).
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/** Public javoblarda faqat shu maydonlar — hech qanday maxfiy narsa chiqmaydi */
const PUBLIC_PLAYER_SELECT = {
  id: true,
  slug: true,
  firstName: true,
  lastName: true,
  gender: true,
  region: true,
  club: true,
  clubRecord: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      regionName: true,
    },
  },
  rankingPoints: true,
  photoUrl: true,
  countryCode: true,
  // Federatsiya reyting ID'si (uttf.uz'dagi "ID raqami"ga mos) — maxfiy emas,
  // reyting jadvalida ham ochiq ko'rinadi.
  licenseNumber: true,
  ageCategory: { select: { code: true, name: true } },
} satisfies Prisma.PlayerSelect;

const PUBLIC_MATCH_SELECT = {
  id: true,
  stage: true,
  status: true,
  tableNumber: true,
  scheduledAt: true,
  bestOf: true,
  player1SetsWon: true,
  player2SetsWon: true,
  currentSetP1: true,
  currentSetP2: true,
  winnerId: true,
  pointsAwarded: true,
  disqualifiedPlayerId: true,
  player1: {
    select: { id: true, slug: true, firstName: true, lastName: true },
  },
  player2: {
    select: { id: true, slug: true, firstName: true, lastName: true },
  },
  tournament: { select: { id: true, slug: true, name: true } },
  sets: {
    select: { setNumber: true, p1Points: true, p2Points: true },
    orderBy: { setNumber: 'asc' as const },
  },
} satisfies Prisma.MatchSelect;

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ommaviy ro'yxat — sahifalangan. Ilgari take:500 bilan kesilardi, bu esa
   * butun bazani bir necha so'rovda yig'ib olishga imkon berardi; endi
   * reyting bo'limi bilan bir xil konvensiya (rows/total/page/pageSize).
   */
  async list(filter: {
    gender?: Gender;
    region?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const pageSize = filter.pageSize
      ? Math.min(Math.max(1, filter.pageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const where: Prisma.PlayerWhereInput = {
      status: 'ACTIVE',
      gender: filter.gender,
      region: filter.region ? { equals: filter.region } : undefined,
      OR: filter.search
        ? [
            { firstName: { contains: filter.search, mode: 'insensitive' } },
            { lastName: { contains: filter.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const total = await this.prisma.player.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, filter.page ?? 1), totalPages);

    const rows = await this.prisma.player.findMany({
      where,
      orderBy: { rankingPoints: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: PUBLIC_PLAYER_SELECT,
    });

    return { rows, total, page, pageSize, totalPages };
  }

  /** Mavjud viloyatlar (filtr ro'yxati uchun) */
  async regions(): Promise<string[]> {
    const rows = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      distinct: ['region'],
      orderBy: { region: 'asc' },
      select: { region: true },
    });
    return rows.map((r) => r.region);
  }

  async detail(idOrSlug: string) {
    const player = await this.prisma.player.findFirst({
      where: { status: 'ACTIVE', OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: PUBLIC_PLAYER_SELECT,
    });
    if (!player) throw new NotFoundException("O'yinchi topilmadi");

    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ player1Id: player.id }, { player2Id: player.id }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: PUBLIC_MATCH_SELECT,
    });

    const rank = await this.rankOf(player.id, player.gender);
    return { ...player, rank, matches };
  }

  /**
   * Profil grafigi va statistikasi:
   * ball tarixi (kumulyativ), kesimlardagi o'rin, g'alaba/mag'lubiyat hisobi.
   */
  async history(idOrSlug: string) {
    const player = await this.prisma.player.findFirst({
      where: { status: 'ACTIVE', OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, slug: true, rankingPoints: true },
    });
    if (!player) throw new NotFoundException("O'yinchi topilmadi");

    const [logs, snapshotEntries, matches] = await Promise.all([
      this.prisma.playerPointsLog.findMany({
        where: { playerId: player.id },
        orderBy: { createdAt: 'asc' },
        take: 300,
        // Izoh va muallif ochiq emas — ular faqat admin log endpointida
        select: { delta: true, reason: true, createdAt: true },
      }),
      this.prisma.rankingSnapshotEntry.findMany({
        where: { playerId: player.id },
        orderBy: { snapshot: { takenAt: 'asc' } },
        take: 60,
        select: {
          rank: true,
          points: true,
          snapshot: { select: { label: true, takenAt: true } },
        },
      }),
      this.prisma.match.findMany({
        where: {
          status: 'FINISHED',
          OR: [{ player1Id: player.id }, { player2Id: player.id }],
        },
        select: {
          winnerId: true,
          player1Id: true,
          stage: true,
          player1SetsWon: true,
          player2SetsWon: true,
        },
      }),
    ]);

    let running = 0;
    const points = logs.map((l) => {
      running += l.delta;
      return {
        date: l.createdAt,
        delta: l.delta,
        points: running,
        reason: l.reason,
      };
    });

    const wins = matches.filter((m) => m.winnerId === player.id).length;
    const titles = matches.filter(
      (m) => m.stage === 'FINAL' && m.winnerId === player.id,
    ).length;
    const setsWon = matches.reduce(
      (sum, m) =>
        sum + (m.player1Id === player.id ? m.player1SetsWon : m.player2SetsWon),
      0,
    );
    const setsLost = matches.reduce(
      (sum, m) =>
        sum + (m.player1Id === player.id ? m.player2SetsWon : m.player1SetsWon),
      0,
    );

    return {
      points,
      ranks: snapshotEntries.map((e) => ({
        label: e.snapshot.label,
        takenAt: e.snapshot.takenAt,
        rank: e.rank,
        points: e.points,
      })),
      stats: {
        played: matches.length,
        wins,
        losses: matches.length - wins,
        winRate: matches.length ? Math.round((wins / matches.length) * 100) : 0,
        titles,
        setsWon,
        setsLost,
      },
    };
  }

  /**
   * Ikki o'yinchi qarshilashuvi (head-to-head): umumiy hisob va o'yinlar ro'yxati.
   */
  async headToHead(aRef: string, bRef: string) {
    const [a, b] = await Promise.all([
      this.prisma.player.findFirst({
        where: { status: 'ACTIVE', OR: [{ id: aRef }, { slug: aRef }] },
        select: PUBLIC_PLAYER_SELECT,
      }),
      this.prisma.player.findFirst({
        where: { status: 'ACTIVE', OR: [{ id: bRef }, { slug: bRef }] },
        select: PUBLIC_PLAYER_SELECT,
      }),
    ]);
    if (!a || !b) throw new NotFoundException("O'yinchi topilmadi");
    if (a.id === b.id) {
      throw new BadRequestException("Bir xil o'yinchi tanlandi");
    }

    const matches = await this.prisma.match.findMany({
      where: {
        status: 'FINISHED',
        OR: [
          { player1Id: a.id, player2Id: b.id },
          { player1Id: b.id, player2Id: a.id },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: PUBLIC_MATCH_SELECT,
    });

    const aWins = matches.filter((m) => m.winnerId === a.id).length;
    const bWins = matches.filter((m) => m.winnerId === b.id).length;
    // Setlar hisobi ham qiziq — kim qanchalik qiyinchilik bilan yutgan
    const sets = matches.reduce(
      (acc, m) => {
        const aIsP1 = m.player1?.id === a.id;
        acc.a += aIsP1 ? m.player1SetsWon : m.player2SetsWon;
        acc.b += aIsP1 ? m.player2SetsWon : m.player1SetsWon;
        return acc;
      },
      { a: 0, b: 0 },
    );

    return {
      playerA: a,
      playerB: b,
      totals: {
        aWins,
        bWins,
        played: matches.length,
        setsA: sets.a,
        setsB: sets.b,
      },
      matches,
    };
  }

  /** O'yinchining joriy reyting o'rni (gender ichida) */
  async rankOf(playerId: string, gender: Gender): Promise<number | null> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { rankingPoints: true },
    });
    if (!player) return null;
    const above = await this.prisma.player.count({
      where: {
        gender,
        status: 'ACTIVE',
        rankingPoints: { gt: player.rankingPoints },
      },
    });
    return above + 1;
  }

  // ==================== admin ====================

  async create(data: {
    firstName: string;
    lastName: string;
    gender: Gender;
    region: string;
    club?: string;
    birthDate?: string;
    licenseNumber?: string;
    photoUrl?: string;
  }) {
    const base = this.slugify(`${data.firstName} ${data.lastName}`);

    // "Bo'sh slugni topib, keyin yozish" poyga holatiga ochiq: bir vaqtda
    // bir xil ismli ikki o'yinchi kiritilsa, ikkalasi ham bitta slugni
    // tanlab, biri unique xatosi bilan 500 berardi. Shuning uchun yozuv
    // urinishi takrorlanadi.
    for (let attempt = 0; attempt < 6; attempt++) {
      const slug =
        attempt === 0
          ? await this.uniqueSlug(base)
          : `${base}-${randomBytes(3).toString('hex')}`;
      try {
        return await this.prisma.player.create({
          data: {
            ...data,
            birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
            slug,
          },
          select: PUBLIC_PLAYER_SELECT,
        });
      } catch (e) {
        const target = uniqueViolationTarget(e);
        if (target?.includes('license_number')) {
          throw new ConflictException('Bu litsenziya raqami band');
        }
        if (!target?.includes('slug')) throw e;
      }
    }
    throw new ConflictException(
      "O'yinchi uchun bo'sh slug topilmadi — ismni o'zgartirib ko'ring",
    );
  }

  async update(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      gender: Gender;
      region: string;
      club: string;
      birthDate: string;
      licenseNumber: string;
      photoUrl: string;
      status: 'ACTIVE' | 'INACTIVE' | 'PENDING_VERIFICATION';
    }>,
  ) {
    const exists = await this.prisma.player.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("O'yinchi topilmadi");
    return this.prisma.player.update({
      where: { id },
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      },
      select: PUBLIC_PLAYER_SELECT,
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.player.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("O'yinchi topilmadi");
    await this.prisma.player.delete({ where: { id } });
    return { ok: true };
  }

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/['ʻʼ`]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'oyinchi'
    );
  }

  /** Bo'sh slug taklifi (yakuniy kafolat emas — yozuvda qayta urinish bor) */
  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; i < 200; i++) {
      const exists = await this.prisma.player.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${i}`;
    }
    return `${base}-${randomBytes(3).toString('hex')}`;
  }
}
