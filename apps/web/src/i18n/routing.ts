import { defineRouting } from 'next-intl/routing';

/**
 * Til marshrutlari: uz — prefixsiz (asosiy), ru/en — prefixli.
 * Localized pathnames: har til o'z URLida (uz: /musobaqalar, en: /events).
 */
export const routing = defineRouting({
  locales: ['uz', 'ru', 'en'],
  defaultLocale: 'uz',
  localePrefix: 'as-needed',
  // URL tilni bir ma'noda belgilaydi: prefiksiz = uz, /ru, /en.
  // Aks holda NEXT_LOCALE cookie prefiksiz sahifalarni boshqa tilda ochib yuborardi.
  localeDetection: false,
  pathnames: {
    '/': '/',
    '/login': '/login',
    '/account': '/account',
    '/join/referee': '/join/referee',
    '/join/coach': '/join/coach',
    '/clubs': { uz: '/klublar', ru: '/kluby', en: '/clubs' },
    '/clubs/open': { uz: '/klublar/ochish', ru: '/kluby/otkrytie', en: '/clubs/open' },
    '/clubs/[slug]': { uz: '/klublar/[slug]', ru: '/kluby/[slug]', en: '/clubs/[slug]' },
    '/panel/applications': '/panel/applications',
    '/panel/referees': '/panel/referees',
    '/panel': '/panel',
    '/live': '/live',
    '/events': {
      uz: '/musobaqalar',
      ru: '/sorevnovaniya',
      en: '/events',
    },
    '/events/[slug]': {
      uz: '/musobaqalar/[slug]',
      ru: '/sorevnovaniya/[slug]',
      en: '/events/[slug]',
    },
    '/rankings': {
      uz: '/reyting',
      ru: '/reyting',
      en: '/rankings',
    },
    '/players': {
      uz: '/oyinchilar',
      ru: '/igroki',
      en: '/players',
    },
    // Statik yo'l dinamik [slug] dan oldin turadi — /oyinchilar/taqqoslash
    // o'yinchi slug'i sifatida talqin qilinmasin
    '/players/compare': {
      uz: '/oyinchilar/taqqoslash',
      ru: '/igroki/sravnenie',
      en: '/players/compare',
    },
    '/players/[slug]': {
      uz: '/oyinchilar/[slug]',
      ru: '/igroki/[slug]',
      en: '/players/[slug]',
    },
    '/news': {
      uz: '/yangiliklar',
      ru: '/novosti',
      en: '/news',
    },
    '/news/[slug]': {
      uz: '/yangiliklar/[slug]',
      ru: '/novosti/[slug]',
      en: '/news/[slug]',
    },
    '/live/[id]': '/live/[id]',
    '/referee': '/referee',
    '/panel/news': '/panel/news',
    '/panel/tournaments': '/panel/tournaments',
    '/panel/levels': '/panel/levels',
    '/panel/players': '/panel/players',
    '/panel/roles': '/panel/roles',
    '/panel/users': '/panel/users',
    '/panel/media': '/panel/media',
    '/panel/federation': '/panel/federation',
    '/panel/inbox': '/panel/inbox',
    '/panel/coach': '/panel/coach',
    '/panel/stream': '/panel/stream',
    '/panel/overlay-ads': '/panel/overlay-ads',
    '/panel/scoreboard': '/panel/scoreboard',
    '/signup': '/signup',
    '/profile': '/profile',
    '/videos': '/videos',
    '/galleries': {
      uz: '/galereya',
      ru: '/galereya',
      en: '/galleries',
    },
    '/galleries/[id]': {
      uz: '/galereya/[id]',
      ru: '/galereya/[id]',
      en: '/galleries/[id]',
    },
    '/about': {
      uz: '/federatsiya',
      ru: '/federaciya',
      en: '/about',
    },
    '/contact': {
      uz: '/aloqa',
      ru: '/kontakty',
      en: '/contact',
    },
    '/search': '/search',
    // Statik sahifalar: maxfiylik siyosati, foydalanish shartlari...
    '/pages/[key]': {
      uz: '/sahifa/[key]',
      ru: '/stranica/[key]',
      en: '/pages/[key]',
    },
    '/panel/pages': '/panel/pages',
  },
});

export type AppPathname = keyof typeof routing.pathnames;
