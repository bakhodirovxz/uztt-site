import type { MetadataRoute } from 'next';
import { localizedUrl, SITE_URL } from '@/lib/seo';
import { routing } from '@/i18n/routing';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

type Href = Parameters<typeof localizedUrl>[0];

/** Har sahifa uchun uch tildagi manzillar (hreflang) bilan yozuv */
function entry(href: Href, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly'): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedUrl(href, l);
  return { url: languages[routing.defaultLocale], changeFrequency, priority, alternates: { languages } };
}

async function json<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${API}/api${path}`, { next: { revalidate: 3600 } });
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Sitemap: statik sahifalar + kattalar o'yinchilari (sahifalab), klublar, yangiliklar, musobaqalar —
 * har biri uz/ru/en hreflang bilan. API o'chiq bo'lsa (build vaqti) faqat statik qism qaytadi.
 */
// Build vaqtida API o'chiq: statik bo'lsa sitemap faqat 13 sahifa bilan "muzlab" qolardi. Ma'lumot 1 soat keshda
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    entry('/', 1, 'daily'),
    entry('/events', 0.9, 'daily'),
    entry('/rankings', 0.9, 'daily'),
    entry('/players', 0.8, 'daily'),
    entry('/news', 0.8, 'daily'),
    entry('/clubs', 0.7, 'weekly'),
    entry('/galleries', 0.5, 'weekly'),
    entry('/videos', 0.5, 'weekly'),
    entry('/about', 0.6, 'monthly'),
    entry('/contact', 0.5, 'monthly'),
    entry('/live', 0.6, 'daily'),
    entry('/join/referee', 0.3, 'monthly'),
    entry('/join/coach', 0.3, 'monthly'),
  ];

  const news = await json<Array<{ slug: string }>>('/news?locale=uz', []);
  for (const n of news) entries.push(entry({ pathname: '/news/[slug]', params: { slug: n.slug } }, 0.6, 'weekly'));

  const tournaments = await json<Array<{ slug: string }>>('/tournaments', []);
  for (const t of tournaments) entries.push(entry({ pathname: '/events/[slug]', params: { slug: t.slug } }, 0.7, 'daily'));

  const clubs = await json<{ rows: Array<{ slug: string }>; total: number }>('/clubs?page=1', { rows: [], total: 0 });
  for (let page = 1, seen = 0; ; page++) {
    const data = page === 1 ? clubs : await json<{ rows: Array<{ slug: string }>; total: number }>(`/clubs?page=${page}`, { rows: [], total: 0 });
    for (const c of data.rows) entries.push(entry({ pathname: '/clubs/[slug]', params: { slug: c.slug } }, 0.5, 'weekly'));
    seen += data.rows.length;
    if (!data.rows.length || seen >= data.total || page >= 40) break;
  }

  // O'yinchilar: 500 tadan sahifalab. Faqat 18 yoshdan oshganlar: bolalar sahifasi indekslanmaydi
  for (let page = 1; page <= 40; page++) {
    const data = await json<{ rows: Array<{ slug: string }>; totalPages?: number }>(`/players?indexable=1&pageSize=500&page=${page}`, { rows: [] });
    for (const p of data.rows) entries.push(entry({ pathname: '/players/[slug]', params: { slug: p.slug } }, 0.5, 'weekly'));
    if (!data.rows.length || page >= (data.totalPages ?? 1)) break;
  }

  return entries;
}
