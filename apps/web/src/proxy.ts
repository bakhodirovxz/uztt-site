import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Scoreboard (planshet / TV / overlay) saytning ichida, shu manzilda ishlaydi:
 *   /control?court=1  — hakam planshetini
 *   /tv, /overlay?court=1, /admin
 * Ichkarida u alohida jarayon (SB_ORIGIN, lokalda standart http://localhost:3101) — yo'llar
 * o'zgarmaydi, shuning uchun tayyor dizayn aynan shu holida qoladi.
 *
 * PRODUCTION'da faqat `SB_ORIGIN` ANIQ berilganda yoqiladi (docker-compose.prod.yml: scoreboard
 * konteyneri). Jarayon bo'lmasa, standart localhost:3101 ga yo'naltirish bu yo'llarni 500 xatoga
 * aylantirardi. Host nginx /api/* ni NestJS'ga yuboradi, shuning uchun SB_EXACT dagi /api yo'llari
 * deploy/stoltennis.uz.nginx.conf da alohida yozilgan — ro'yxatni o'zgartirsang, u yerda ham o'zgartir.
 */
const SB_ORIGIN = (process.env.SB_ORIGIN ?? 'http://localhost:3101').replace(/\/$/, '');
const SB_ENABLED = !!process.env.SB_ORIGIN || process.env.NODE_ENV !== 'production';

const SB_EXACT = new Set([
  '/control', '/tv', '/overlay', '/admin', '/card', '/sb/events',
  '/api/action', '/api/data', '/api/data/check', '/api/settings', '/api/ads', '/api/card',
  '/api/public', '/api/history', '/api/all', '/api/state', '/api/telegram-test', '/api/pdb/search', '/api/pdb/link',
]);
const SB_PREFIX = ['/api/ads/', '/flags/', '/ads/'];
const SB_STATIC = /^\/(board\.css|board\.js|common\.js|scenes\.js|flags\.js|logo-left\.png|logo-right\.png)$/;
const SB_PHOTO = /^\/players\/[\w-]+\.(jpg|jpeg|png|webp|svg)$/;
/**
 * Ruxsat darajalari:
 *  - 'score'  — hakam planshetini (match.score yoki match.manage)
 *  - 'manage' — boshqaruv: admin sahifasi, sozlamalar, ma'lumotni yozish, reklamalar (faqat match.manage)
 * GET/HEAD dan boshqa HAR QANDAY scoreboard so'rovi kamida 'manage' talab qiladi (hakam amali bundan mustasno).
 */
type SbPerm = 'score' | 'manage' | null;
const SB_SCORE_WRITE = new Set(['/api/action']);
// /api/pdb/search — o'yinchilar bazasi (ism, yosh, hudud; asosan bolalar): faqat hakam/admin
const SB_SCORE_READ = new Set(['/control', '/api/data', '/api/pdb/search']);
const SB_MANAGE_ANY = new Set(['/admin', '/api/settings', '/api/data/check', '/api/telegram-test', '/api/pdb/link']);

function requiredPerm(pathname: string, method: string): SbPerm {
  const read = method === 'GET' || method === 'HEAD';
  if (SB_MANAGE_ANY.has(pathname)) return 'manage';
  if (!read) return SB_SCORE_WRITE.has(pathname) ? 'score' : 'manage';
  if (pathname.startsWith('/api/ads/')) return 'manage';
  if (SB_SCORE_READ.has(pathname)) return 'score';
  return null;
}

const I18N_PATH = /^\/(?!api|_next|_vercel|overlay|screen)[^.]*$/;

function isScoreboardPath(p: string, sp: URLSearchParams) {
  if (!SB_ENABLED) return false;
  // /events — saytning o'z sahifasi (next-intl ichki yo'li). Eski scoreboard mijozlari jonli
  // oqimni shu yerdan ?all= yoki ?court= bilan so'raydi; yangilari /sb/events ishlatadi.
  if (p === '/events') return sp.has('all') || sp.has('court');
  return SB_EXACT.has(p) || SB_STATIC.test(p) || SB_PHOTO.test(p) || SB_PREFIX.some((x) => p.startsWith(x));
}

function guardOn() {
  if (process.env.SB_GUARD === '0') return false;
  return process.env.SB_GUARD === '1' || process.env.NODE_ENV === 'production';
}

async function allowed(req: NextRequest, need: 'score' | 'manage'): Promise<boolean> {
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
    if (perms.includes('match.manage')) return true;
    return need === 'score' && perms.includes('match.score');
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isScoreboardPath(pathname, req.nextUrl.searchParams)) {
    const need = requiredPerm(pathname, req.method);
    if (need && guardOn() && !(await allowed(req, need))) {
      if (pathname === '/control' || pathname === '/admin') {
        return NextResponse.redirect(new URL('/login', req.url));
      }
      return NextResponse.json({ ok: false, error: 'Kirish talab qilinadi' }, { status: 401 });
    }
    // Saytning auth cookie'lari (JWT) scoreboard jarayoniga uzatilmaydi: ruxsat yuqorida tekshirildi.
    // Faqat scoreboard'ning o'z tokeni (sb_token, SB_ADMIN_TOKEN bilan) o'tadi — aks holda
    // token bilan himoyalangan scoreboard planshetlarga 401 qaytaradi.
    const headers = new Headers(req.headers);
    const sbToken = req.cookies.get('sb_token')?.value;
    if (sbToken) headers.set('cookie', `sb_token=${sbToken}`);
    else headers.delete('cookie');
    return NextResponse.rewrite(new URL(SB_ORIGIN + pathname + search), { request: { headers } });
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
