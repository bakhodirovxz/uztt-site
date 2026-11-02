import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Panel, hakam, overlay/TV, kirish va shaxsiy sahifalar indekslanmaydi (3 tilda ham)
        disallow: [
          '/panel', '/referee', '/overlay/', '/screen/', '/profile', '/login', '/signup', '/account',
          '/ru/panel', '/ru/referee', '/ru/profile', '/ru/login', '/ru/signup', '/ru/account',
          '/en/panel', '/en/referee', '/en/profile', '/en/login', '/en/signup', '/en/account',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
