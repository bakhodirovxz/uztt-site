import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100';
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** Sitemap: statik sahifalar (3 tilda) + dinamik kontent (yangiliklar, o'yinchilar, musobaqalar) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Til prefikslari: uz — prefiksisiz, ru/en — prefiksli
  const staticPaths: Array<{ uz: string; ru: string; en: string }> = [
    { uz: '/', ru: '/ru', en: '/en' },
    { uz: '/musobaqalar', ru: '/ru/sorevnovaniya', en: '/en/events' },
    { uz: '/reyting', ru: '/ru/reyting', en: '/en/rankings' },
    { uz: '/oyinchilar', ru: '/ru/igroki', en: '/en/players' },
    { uz: '/yangiliklar', ru: '/ru/novosti', en: '/en/news' },
    { uz: '/videos', ru: '/ru/videos', en: '/en/videos' },
    { uz: '/galereya', ru: '/ru/galereya', en: '/en/galleries' },
    { uz: '/federatsiya', ru: '/ru/federaciya', en: '/en/about' },
    { uz: '/aloqa', ru: '/ru/kontakty', en: '/en/contact' },
    { uz: '/live', ru: '/ru/live', en: '/en/live' },
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: SITE_URL + p.uz,
    changeFrequency: 'daily',
    priority: p.uz === '/' ? 1 : 0.8,
    alternates: {
      languages: {
        uz: SITE_URL + p.uz,
        ru: SITE_URL + p.ru,
        en: SITE_URL + p.en,
      },
    },
  }));

  // Dinamik kontent — API mavjud bo'lmasa jim o'tkazamiz (build vaqtida ham xavfsiz)
  try {
    const [news, players, tournaments] = await Promise.all([
      fetch(`${API}/api/news?locale=uz`, { next: { revalidate: 3600 } })
        .then((r) => r.json() as Promise<Array<{ slug: string }>>)
        .catch(() => []),
      // /api/players endi sahifalangan javob qaytaradi ({ rows, total, ... }).
      // pageSize chegarasi 500 — sitemap hozircha birinchi 500 o'yinchini
      // qamraydi (ilgari take:500 bilan ham shunday edi). To'liq qamrov uchun
      // sahifalab yurish kerak, bu alohida ish.
      fetch(`${API}/api/players?pageSize=500`, { next: { revalidate: 3600 } })
        .then(
          (r) => r.json() as Promise<{ rows: Array<{ slug: string }> }>,
        )
        .then((d) => d.rows ?? [])
        .catch(() => []),
      fetch(`${API}/api/tournaments`, { next: { revalidate: 3600 } })
        .then((r) => r.json() as Promise<Array<{ slug: string }>>)
        .catch(() => []),
    ]);

    for (const n of news) {
      entries.push({
        url: `${SITE_URL}/yangiliklar/${n.slug}`,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
    for (const p of players) {
      entries.push({
        url: `${SITE_URL}/oyinchilar/${p.slug}`,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
    for (const t of tournaments) {
      entries.push({
        url: `${SITE_URL}/musobaqalar/${t.slug}`,
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
  } catch {
    // API o'chiq — faqat statik sahifalar
  }

  return entries;
}
