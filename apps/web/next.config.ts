import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// CSP hozircha faqat Report-Only. Sabab: redizayn davomida sahifalar
// o'zgarib turadi, jonli saytda darhol majburlash kafolatlangan sindirish.
// `unsafe-inline` next/font inline stillari va JSON-LD skriptlari uchun —
// sahifa o'zgarishlari to'xtagach nonce'ga o'tib, enforcing qilinadi.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Socket.io jonli hisob uchun (bir xil domen, nginx orqali)
  "connect-src 'self' ws: wss:",
  // YouTube ko'milgan videolari
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone', // Docker image uchun minimal server chiqishi
  poweredByHeader: false,
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
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
        ],
      },
      {
        // Sayt sahifalari hech qayerga o'rnatilmasligi kerak.
        // /overlay va /screen istisno — quyida.
        source: '/((?!overlay|screen).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      {
        // OBS Browser Source iframe emas, lekin zal monitorida /screen
        // iframe ichida ochilishi mumkin — ularni bloklamaymiz.
        source: '/:path(overlay|screen)/:rest*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ];
  },
};

// DIQQAT: `outputFileTracingRoot` / `turbopack.root` ni monorepo ildiziga
// qo'lda o'rnatib ko'rildi (build ogohlantirishini yo'qotish uchun) — natijada
// standalone serverda "/" 307 redirect siklida qolib ketdi. Ogohlantirish
// zararsiz; sozlamani o'zgartirmang.

export default withNextIntl(nextConfig);
