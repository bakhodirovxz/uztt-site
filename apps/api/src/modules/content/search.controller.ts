import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/** Til → Postgres FTS konfiguratsiyasi (o'zbekcha uchun stemmer yo'q) */
const FTS_CONFIG: Record<string, string> = {
  ru: 'russian',
  en: 'english',
  uz: 'simple',
};

interface PlayerHit {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  region: string;
  rankingPoints: number;
  score: number;
}

interface TournamentHit {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  startDate: Date;
  status: string;
  score: number;
}

interface NewsHit {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  category: string | null;
  score: number;
}

/**
 * Guruhlangan qidiruv: o'yinchilar, musobaqalar, yangiliklar.
 * Yangiliklar — Postgres FTS (tsvector, tilga mos konfiguratsiya bilan),
 * ismlar va musobaqa nomlari — pg_trgm o'xshashligi (xato yozuvga chidamli).
 */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async search(@Query('q') q?: string, @Query('locale') locale?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) {
      return { players: [], tournaments: [], news: [] };
    }
    const config = FTS_CONFIG[locale ?? 'uz'] ?? 'simple';
    const loc = FTS_CONFIG[locale ?? ''] ? locale! : 'uz';

    const [players, tournaments, news] = await Promise.all([
      this.players(query, 8),
      this.tournaments(query, 6),
      this.news(query, loc, config, 8),
    ]);

    return { players, tournaments, news };
  }

  /** Sarlavhaga tez javob beruvchi typeahead (header qidiruv maydoni uchun) */
  @Public()
  @Get('typeahead')
  async typeahead(@Query('q') q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) return { players: [] };
    return { players: await this.players(query, 6) };
  }

  /**
   * O'xshashlik bo'yicha: "karimv" ham "Karimov"ni topadi.
   * Boshlanishiga mos kelgan natija oldinga chiqadi (odatdagi kutilma).
   */
  private players(query: string, take: number) {
    const like = `%${query.toLowerCase()}%`;
    return this.prisma.$queryRaw<PlayerHit[]>`
      SELECT id, slug, first_name AS "firstName", last_name AS "lastName",
             region, ranking_points AS "rankingPoints",
             GREATEST(
               similarity(lower(first_name || ' ' || last_name), ${query.toLowerCase()}),
               similarity(lower(coalesce(club, '')), ${query.toLowerCase()})
             ) AS score
      FROM players
      WHERE status = 'ACTIVE'
        AND (
          lower(first_name || ' ' || last_name) LIKE ${like}
          OR lower(coalesce(club, '')) LIKE ${like}
          OR lower(first_name || ' ' || last_name) % ${query.toLowerCase()}
        )
      ORDER BY score DESC, ranking_points DESC
      LIMIT ${take}
    `;
  }

  private tournaments(query: string, take: number) {
    const like = `%${query.toLowerCase()}%`;
    return this.prisma.$queryRaw<TournamentHit[]>`
      SELECT id, slug, name, city, start_date AS "startDate", status::text AS status,
             similarity(lower(name), ${query.toLowerCase()}) AS score
      FROM tournaments
      WHERE lower(name) LIKE ${like}
         OR lower(name) % ${query.toLowerCase()}
      ORDER BY score DESC, start_date DESC
      LIMIT ${take}
    `;
  }

  private news(query: string, locale: string, config: string, take: number) {
    // Konfiguratsiya nomi ro'yxatdan keladi (foydalanuvchi kiritmaydi) —
    // shuning uchun uni identifikator sifatida qo'yish xavfsiz.
    const cfg = Prisma.raw(`'${config}'`);
    return this.prisma.$queryRaw<NewsHit[]>`
      SELECT nt.slug, nt.title, nt.excerpt,
             na.published_at AS "publishedAt", na.category,
             ts_rank(nt.search_vector, websearch_to_tsquery(${cfg}, ${query})) AS score
      FROM news_translations nt
      JOIN news_articles na ON na.id = nt.article_id
      WHERE nt.locale = ${locale}
        AND na.status = 'PUBLISHED'
        AND nt.search_vector @@ websearch_to_tsquery(${cfg}, ${query})
      ORDER BY score DESC, na.published_at DESC
      LIMIT ${take}
    `;
  }
}
