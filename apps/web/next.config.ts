import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// CSP majburiy. `unsafe-inline` next/font inline stillari, JSON-LD va scoreboard
// sahifalari uchun; nonce'ga o'tilsa olib tashlanadi. Ma'lumot tashqi manzilga
// yuborilmasligi connect-src va img-src bilan cheklanadi.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const csp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // i.ytimg.com: video muqovalari; uttf.uz: import qilingan yangiliklardagi rasmlar
    "img-src 'self' data: blob: https://i.ytimg.com https://uttf.uz",
    "font-src 'self' data:",
    // blob: hakamning ovozli yozuvini tinglash uchun
    "media-src 'self' blob:",
    // Socket.io jonli hisob uchun (bir xil domen, nginx orqali)
    `connect-src 'self'${API_ORIGIN ? ` ${API_ORIGIN} ${API_ORIGIN.replace(/^http/, 'ws')}` : ''}`,
    // YouTube ko'milgan videolari
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  ].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone', // Docker image uchun minimal server chiqishi
  poweredByHeader: false,
  // Scoreboard jonli oqimi (SSE) saytdan o'tadi: siqish uni bufer qilib qo'yadi
  compress: false,
  // Lokal ishga tushirishda (nginx yo'q) /uploads/... fayllari API'dan olinadi. Serverda nginx bu yo'lni o'zi ushlaydi.
  async rewrites() {
    const api = (process.env.UPLOADS_PROXY ?? 'http://localhost:4000').replace(/\/$/, '');
    return [{ source: '/uploads/:path*', destination: `${api}/uploads/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // Sayt sahifalari hech qayerga o'rnatilmasligi kerak.
        // /overlay va /screen istisno — quyida.
        source: '/((?!overlay|screen).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp("'none'") },
        ],
      },
      {
        // OBS Browser Source iframe emas, lekin zal monitorida /screen
        // iframe ichida ochilishi mumkin — ularni bloklamaymiz.
        source: '/:path(overlay|screen)/:rest*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: csp("'self'") },
        ],
      },
    ];
  },
};

// DIQQAT: `outputFileTracingRoot` / `turbopack.root` ni monorepo ildiziga
// qo'lda o'rnatib ko'rildi (build ogohlantirishini yo'qotish uchun) — natijada
// standalone serverda "/" 307 redirect siklida qolib ketdi. Ogohlantirish
// zararsiz; sozlamani o'zgartirmang.

export default withNextIntl(nextConfig);
