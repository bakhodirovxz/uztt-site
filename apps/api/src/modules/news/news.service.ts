import { Injectable, NotFoundException } from '@nestjs/common';
import { NewsStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LOCALES = ['uz', 'ru', 'en'] as const;
type Locale = (typeof LOCALES)[number];

function normalizeLocale(locale?: string): Locale {
  return (LOCALES as readonly string[]).includes(locale ?? '')
    ? (locale as Locale)
    : 'uz';
}

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Nashr qilingan yangiliklar — so'ralgan til, bo'lmasa uz fallback */
  async list(locale?: string, tournamentId?: string) {
    const loc = normalizeLocale(locale);
    const articles = await this.prisma.newsArticle.findMany({
      where: { status: 'PUBLISHED', tournamentId },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: { translations: true },
    });
    return articles
      .map((a) => this.pick(a, loc))
      .filter((a): a is NonNullable<ReturnType<NewsService['pick']>> => !!a);
  }

  async bySlug(slug: string, locale?: string) {
    const loc = normalizeLocale(locale);
    const tr = await this.prisma.newsTranslation.findFirst({
      where: { slug, article: { status: 'PUBLISHED' } },
      include: { article: { include: { translations: true } } },
    });
    if (!tr) throw new NotFoundException('Yangilik topilmadi');
    const picked = this.pick(tr.article, loc) ?? this.pick(tr.article, 'uz');
    if (!picked) throw new NotFoundException('Yangilik topilmadi');
    return picked;
  }

  // ==================== admin ====================

  adminList() {
    return this.prisma.newsArticle.findMany({
      orderBy: { createdAt: 'desc' },
      include: { translations: true },
    });
  }

  async create(data: {
    category?: string;
    isFeatured?: boolean;
    status?: NewsStatus;
    coverImageUrl?: string;
    tournamentId?: string;
    translations: Array<{
      locale: string;
      title: string;
      slug?: string;
      excerpt?: string;
      body: string;
    }>;
  }) {
    const created = await this.prisma.newsArticle.create({
      data: {
        category: data.category,
        isFeatured: data.isFeatured ?? false,
        status: data.status ?? 'DRAFT',
        coverImageUrl: data.coverImageUrl,
        tournamentId: data.tournamentId,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        translations: {
          create: data.translations.map((t) => ({
            locale: t.locale,
            title: t.title,
            slug: t.slug ?? this.slugify(t.title),
            excerpt: t.excerpt,
            body: t.body,
          })),
        },
      },
      include: { translations: true },
    });
    return created;
  }

  async update(
    id: string,
    data: {
      category?: string;
      isFeatured?: boolean;
      status?: NewsStatus;
      coverImageUrl?: string;
      tournamentId?: string;
      translations?: Array<{
        locale: string;
        title: string;
        slug?: string;
        excerpt?: string;
        body: string;
      }>;
    },
  ) {
    const exists = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yangilik topilmadi');

    if (data.translations) {
      for (const t of data.translations) {
        await this.prisma.newsTranslation.upsert({
          where: { articleId_locale: { articleId: id, locale: t.locale } },
          update: {
            title: t.title,
            slug: t.slug ?? this.slugify(t.title),
            excerpt: t.excerpt,
            body: t.body,
          },
          create: {
            articleId: id,
            locale: t.locale,
            title: t.title,
            slug: t.slug ?? this.slugify(t.title),
            excerpt: t.excerpt,
            body: t.body,
          },
        });
      }
    }

    const updated = await this.prisma.newsArticle.update({
      where: { id },
      data: {
        category: data.category,
        isFeatured: data.isFeatured,
        status: data.status,
        coverImageUrl: data.coverImageUrl,
        tournamentId: data.tournamentId,
        publishedAt:
          data.status === 'PUBLISHED' && !exists.publishedAt
            ? new Date()
            : undefined,
      },
      include: { translations: true },
    });
    return updated;
  }

  async remove(id: string) {
    const exists = await this.prisma.newsArticle.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Yangilik topilmadi');
    await this.prisma.newsArticle.delete({ where: { id } });
    return { ok: true };
  }

  // ==================== ichki ====================

  private pick(
    article: {
      id: string;
      category: string | null;
      coverImageUrl: string | null;
      isFeatured: boolean;
      status: NewsStatus;
      publishedAt: Date | null;
      translations: Array<{
        locale: string;
        title: string;
        slug: string;
        excerpt: string | null;
        body: string;
      }>;
    },
    locale: Locale,
  ) {
    const tr =
      article.translations.find((t) => t.locale === locale) ??
      article.translations.find((t) => t.locale === 'uz');
    if (!tr) return null;
    return {
      id: article.id,
      category: article.category,
      coverImageUrl: article.coverImageUrl,
      isFeatured: article.isFeatured,
      publishedAt: article.publishedAt,
      locale: tr.locale,
      title: tr.title,
      slug: tr.slug,
      excerpt: tr.excerpt,
      body: tr.body,
    };
  }

  private slugify(s: string): string {
    return (
      s
        .toLowerCase()
        .replace(/['ʻʼ`’]/g, '')
        .replace(/[а-яё]/g, (c) => c) // kirill saqlanadi, faqat bo'shliqlar almashadi
        .replace(/[^a-zа-яё0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '') || `post-${Date.now()}`
    );
  }
}
