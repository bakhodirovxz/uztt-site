import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Scoreboard (planshet / TV / overlay) saytning ichida, shu manzilda ishlaydi:
 *   /control?court=1  — hakam planshetini
 *   /tv, /overlay?court=1, /admin
 * Ichkarida u alohida jarayon (SB_ORIGIN, standart http://localhost:3100) — yo'llar o'zgarmaydi,
 * shuning uchun tayyor dizayn aynan shu holida qoladi.
 */
const SB_ORIGIN = (process.env.SB_ORIGIN ?? 'http://localhost:3101').replace(/\/$/, '');

const SB_EXACT = new Set([
  '/control', '/tv', '/overlay', '/admin', '/card',
  '/api/action', '/api/data', '/api/data/check', '/api/settings', '/api/ads', '/api/card',
  '/api/public', '/api/history', '/api/all', '/api/state', '/api/telegram-test', '/api/pdb/search', '/api/pdb/link',
]);
const SB_PREFIX = ['/api/ads/', '/flags/', '/ads/'];
const SB_STATIC = /^\/(board\.css|board\.js|common\.js|scenes\.js|flags\.js|logo-left\.png|logo-right\.png)$/;
const SB_PHOTO = /^\/players\/[\w-]+\.(jpg|jpeg|png|webp|svg)$/;
// o'zgartiruvchi yoki boshqaruv yo'llari: faqat tizimga kirgan hakam/administrator
const SB_PROTECTED = new Set(['/control', '/admin', '/api/action', '/api/data', '/api/data/check', '/api/settings', '/api/telegram-test', '/api/pdb/link']);

const I18N_PATH = /^\/(?!api|_next|_vercel|overlay|screen)[^.]*$/;

function isScoreboardPath(p: string, sp: URLSearchParams) {
  // /events — saytning o'z sahifasi; scoreboard jonli oqimi faqat ?all= yoki ?court= bilan keladi
  if (p === '/events') return sp.has('all') || sp.has('court');
  return SB_EXACT.has(p) || SB_STATIC.test(p) || SB_PHOTO.test(p) || SB_PREFIX.some((x) => p.startsWith(x));
}

function guardOn() {
  if (process.env.SB_GUARD === '0') return false;
  return process.env.SB_GUARD === '1' || process.env.NODE_ENV === 'production';
}

async function allowed(req: NextRequest): Promise<boolean> {
  try {
    const api = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    const r = await fetch(`${api}/api/auth/me`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return false;
    const { user } = (await r.json()) as { user?: { permissions?: string[] } };
    const perms = user?.permissions ?? [];
    return perms.includes('match.score') || perms.includes('match.manage');
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isScoreboardPath(pathname, req.nextUrl.searchParams)) {
    if (SB_PROTECTED.has(pathname) && guardOn() && !(await allowed(req))) {
      if (pathname === '/control' || pathname === '/admin') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
      return NextResponse.json({ ok: false, error: 'Kirish talab qilinadi' }, { status: 401 });
    }
    return NextResponse.rewrite(new URL(SB_ORIGIN + pathname + search));
  }
  // faqat sayt sahifalari i18n'dan o'tadi (qolgan moslashuvlar yuqoridagi scoreboard yo'llari uchun edi)
  if (!I18N_PATH.test(pathname)) return NextResponse.next();
  return intl(req);
}

export const config = {
  // api (sayt API'si), statik fayllar va OBS overlay/zal monitori i18n'dan tashqarida.
  // Scoreboard yo'llari (yuqorida) shu yerda ushlanib, ichki scoreboard jarayoniga yo'naltiriladi.
  matcher: [
    '/((?!api|_next|_vercel|overlay|screen|.*\\..*).*)',
    '/overlay', '/api/:path*', '/flags/:path*', '/ads/:path*', '/players/:file*', '/board.css', '/board.js', '/common.js',
    '/scenes.js', '/flags.js', '/logo-left.png', '/logo-right.png',
  ],
};
