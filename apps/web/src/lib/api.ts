/**
 * API mijozi. Brauzerda NEXT_PUBLIC_API_URL, serverda API_INTERNAL_URL
 * ishlatiladi (Docker'da: http://api:4000).
 */
import { routing } from '@/i18n/routing';

const BROWSER_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const SERVER_BASE = process.env.API_INTERNAL_URL ?? BROWSER_BASE;

function baseUrl(): string {
  return typeof window === 'undefined' ? SERVER_BASE : BROWSER_BASE;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Joriy til saqlangan /account manzili (uz — prefikssiz, ru/en — /ru, /en).
 * `/account` uchala tilda bir xil yo'l (routing.ts), shuning uchun faqat prefiks kerak.
 */
function accountPathForCurrentLocale(): string {
  const seg = window.location.pathname.split('/')[1] ?? '';
  const locales = routing.locales as readonly string[];
  const prefix = locales.includes(seg) && seg !== routing.defaultLocale ? `/${seg}` : '';
  return `${prefix}/account`;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Access token 15 daqiqa yashaydi, sessiya esa refresh token bilan davom etadi. Token aylantiriladi:
 * eski token qayta yuborilsa API butun sessiyani bekor qiladi, shuning uchun bir nechta tab bir vaqtda
 * yangilamasin (Web Locks; scoreboard'ning public/session.js fayli ham shu qulfni ishlatadi).
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const post = () =>
    fetch(`${baseUrl()}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false);
  const run = Promise.resolve(navigator.locks ? navigator.locks.request('uztt-session', post) : post());
  const current = run.finally(() => {
    refreshing = null;
  });
  refreshing = current;
  return current;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const send = () =>
    fetch(`${baseUrl()}/api${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    });
  let res = await send();
  if (res.status === 401 && typeof window !== 'undefined' && path !== '/auth/login' && (await refreshSession())) {
    res = await send();
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[]; code?: string };
      // Boshlang'ich parol: parol almashtirilmaguncha hamma amal yopiq → almashtirish sahifasiga
      if (res.status === 403 && data.code === 'PASSWORD_CHANGE_REQUIRED' && typeof window !== 'undefined' && !window.location.pathname.endsWith('/account')) {
        window.location.assign(accountPathForCurrentLocale());
      }
      message = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? message);
    } catch {
      // JSON bo'lmagan javob
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

/** ISR teglari — API kontent o'zgarganda /api/revalidate orqali tozalanadi */
export type CacheTag = 'news' | 'pages' | 'federation' | 'media' | 'tournaments';

/**
 * Keshlangan GET: sahifa qayta yig'ilmasdan turadi, admin kontentni
 * o'zgartirsa API webhook orqali darhol yangilaydi. `revalidate` — zaxira
 * muddat (webhook yetib bormasa ham kontent eskirib qolmaydi).
 */
export function cached(tag: CacheTag, revalidate = 300): RequestInit {
  return { next: { tags: [tag], revalidate } } as RequestInit;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('POST', path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('PUT', path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('PATCH', path, body, init),
  del: <T>(path: string, init?: RequestInit) =>
    request<T>('DELETE', path, undefined, init),
};

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
}
