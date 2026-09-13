import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, TournamentStatus, Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { uniqueViolationTarget } from '../../common/prisma-errors';

const PUBLIC_TOURNAMENT_SELECT = {
  id: true,
  slug: true,
  name: true,
  city: true,
  venue: true,
  gender: true,
  startDate: true,
  endDate: true,
  status: true,
  bannerImageUrl: true,
  level: { select: { code: true, name: true, coefficient: true } },
  ageCategory: { select: { code: true, name: true } },
  translations: { select: { locale: true, name: true } },
} satisfies Prisma.TournamentSelect;

/**
 * Musobaqa nomini so'ralgan tilga ko'chiradi.
 * Tarjima bo'lmasa asl nom qoladi — bo'sh joy chiqmaydi.
 * `translations` massivi javobdan olib tashlanadi: mijozga kerak emas.
 */
function localizeTournament<T extends { name: string; translations?: Array<{ locale: string; name: string }> }>(
  t: T,
  locale?: string,
): Omit<T, 'translations'> {
  const { translations, ...rest } = t;
  const hit = locale ? translations?.find((x) => x.locale === locale) : undefined;
  return { ...rest, name: hit?.name?.trim() || t.name };
}

/** O'yin javobida hech qachon refereeCodeHash/overlayToken chiqmaydi */
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
  seq: true,
  player1: {
    select: { id: true, slug: true, firstName: true, lastName: true },
  },
  player2: {
    select: { id: true, slug: true, firstName: true, lastName: true },
  },
  sets: {
    select: { setNumber: true, p1Points: true, p2Points: true },
    orderBy: { setNumber: 'asc' as const },
  },
  cards: { select: { player: true, type: true, setNumber: true } },
} satisfies Prisma.MatchSelect;

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { status?: TournamentStatus; locale?: string }) {
    const rows = await this.prisma.tournament.findMany({
      where: { status: filter.status },
      orderBy: { startDate: 'desc' },
      select: PUBLIC_TOURNAMENT_SELECT,
    });
    return rows.map((t) => localizeTournament(t, filter.locale));
  }

  async detail(idOrSlug: string, locale?: string) {
    const t = await this.prisma.tournament.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: {
        ...PUBLIC_TOURNAMENT_SELECT,
        matches: {
          select: PUBLIC_MATCH_SELECT,
          orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
        },
        categories: {
          select: {
            id: true,
            gender: true,
            eventType: true,
            maxEntries: true,
            registrationDeadline: true,
            ageCategory: {
              select: { code: true, name: true, sortOrder: true },
            },
          },
        },
      },
    });
    if (!t) throw new NotFoundException('Musobaqa topilmadi');

    // Ariza sonlari bitta guruhlangan so'rovda. Avval barcha arizalar tortib
    // olinib JS'da sanalardi — katta turnirda bu minglab ortiqcha qator.
    const categoryIds = t.categories.map((c) => c.id);
    const counts = await this.prisma.tournamentRegistration.groupBy({
      by: ['tournamentCategoryId', 'status'],
      where: { tournamentCategoryId: { in: categoryIds } },
      _count: { _all: true },
    });
    const countOf = (categoryId: string, status?: string) =>
      counts
        .filter(
          (c) =>
            c.tournamentCategoryId === categoryId &&
            (status === undefined || c.status === status),
        )
        .reduce((sum, c) => sum + (c._count?._all ?? 0), 0);

    const categories = t.categories
      .map((c) => ({
        ...c,
        entries: {
          confirmed: countOf(c.id, 'CONFIRMED'),
          pending: countOf(c.id, 'PENDING'),
          total: countOf(c.id),
        },
      }))
      .sort(
        (a, b) =>
          a.ageCategory.sortOrder - b.ageCategory.sortOrder ||
          (a.gender ?? '').localeCompare(b.gender ?? ''),
      );

    return { ...localizeTournament(t, locale), categories };
  }

  async create(data: {
    name: string;
    levelCode: string;
    city?: string;
    venue?: string;
    gender?: Gender;
    startDate: string;
    endDate: string;
  }) {
    const level = await this.prisma.tournamentLevel.findUnique({
      where: { code: data.levelCode },
    });
    if (!level) throw new NotFoundException('Daraja topilmadi');

    // Slug poyga holatiga chidamli: bir vaqtda bir xil nomli ikki musobaqa
    // ochilsa ham 500 emas, yangi slug bilan qayta urinadi.
    const base = this.slugifyName(data.name);
    for (let attempt = 0; attempt < 6; attempt++) {
      const slug =
        attempt === 0
          ? await this.uniqueSlug(base)
          : `${base}-${randomBytes(3).toString('hex')}`;
      try {
        return await this.createWithSlug(slug, level.id, data);
      } catch (e) {
        if (!uniqueViolationTarget(e)?.includes('slug')) throw e;
      }
    }
    throw new ConflictException('Musobaqa uchun bo‘sh slug topilmadi');
  }

  private createWithSlug(
    slug: string,
    levelId: string,
    data: {
      name: string;
      city?: string;
      venue?: string;
      gender?: Gender;
      startDate: string;
      endDate: string;
    },
  ) {
    return this.prisma.tournament.create({
      data: {
        slug,
        name: data.name,
        levelId,
        city: data.city,
        venue: data.venue,
        gender: data.gender,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
      select: PUBLIC_TOURNAMENT_SELECT,
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      levelCode: string;
      city: string;
      venue: string;
      gender: Gender;
      startDate: string;
      endDate: string;
      status: TournamentStatus;
    }>,
  ) {
    const exists = await this.prisma.tournament.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Musobaqa topilmadi');

    let levelId: string | undefined;
    if (data.levelCode) {
      const level = await this.prisma.tournamentLevel.findUnique({
        where: { code: data.levelCode },
      });
      if (!level) throw new NotFoundException('Daraja topilmadi');
      levelId = level.id;
    }

    return this.prisma.tournament.update({
      where: { id },
      data: {
        name: data.name,
        levelId,
        city: data.city,
        venue: data.venue,
        gender: data.gender,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      select: PUBLIC_TOURNAMENT_SELECT,
    });
  }

  /** Musobaqa yaratish formasi uchun: daraja + uning reglamenti */
  async levels() {
    const rows = await this.prisma.tournamentLevel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { coefficient: 'desc' }],
      select: {
        code: true,
        name: true,
        description: true,
        coefficient: true,
        pointsRules: { select: { key: true, points: true } },
      },
    });
    return rows.map(({ pointsRules, ...level }) => ({
      ...level,
      rules: pointsRules,
    }));
  }

  private slugifyName(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/['ʻʼ`’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'musobaqa'
    );
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; i < 200; i++) {
      const exists = await this.prisma.tournament.findUnique({
        where: { slug },
      });
      if (!exists) return slug;
      slug = `${base}-${i}`;
    }
    return `${base}-${randomBytes(3).toString('hex')}`;
  }
}
