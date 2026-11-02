import type { Metadata } from 'next';
import { getPathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stoltennis.uz').replace(/\/$/, '');
const OG_LOCALE: Record<string, string> = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' };

type Href = Parameters<typeof getPathname>[0]['href'];

/** Til bo'yicha to'liq manzil (uz — prefikssiz, ru/en — prefiksli) */
export function localizedUrl(href: Href, locale: string): string {
  const path = getPathname({ href, locale: locale as (typeof routing.locales)[number] });
  return `${SITE_URL}${path === '/' ? '' : path}` || SITE_URL;
}

/**
 * Har sahifa uchun yagona SEO metama'lumot: title, description, canonical, hreflang (uz/ru/en + x-default),
 * Open Graph va Twitter karta. `noindex` — shaxsiy/texnik sahifalar uchun.
 */
export function pageMeta({
  locale,
  href,
  title,
  description,
  image,
  type = 'website',
  noindex = false,
}: {
  locale: string;
  href: Href;
  title: string;
  description: string;
  image?: string | null;
  type?: 'website' | 'article' | 'profile';
  noindex?: boolean;
}): Metadata {
  const url = localizedUrl(href, locale);
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localizedUrl(href, l);
  languages['x-default'] = localizedUrl(href, routing.defaultLocale);
  const desc = description.length > 170 ? `${description.slice(0, 167).trimEnd()}…` : description;
  const img = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : `${SITE_URL}/og-default.png`;
  return {
    title,
    description: desc,
    alternates: { canonical: url, languages },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description: desc, url, type: type === 'profile' ? 'profile' : type, locale: OG_LOCALE[locale] ?? 'uz_UZ', siteName: 'UZTT', images: [{ url: img }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}
