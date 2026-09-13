/**
 * API mijozi. Brauzerda NEXT_PUBLIC_API_URL, serverda API_INTERNAL_URL
 * ishlatiladi (Docker'da: http://api:4000).
 */
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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl()}/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[] };
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
}
