import { Logger } from '@nestjs/common';

/**
 * uttf.uz ichki API mijozi.
 *
 * Endpointlar taxmin qilinmagan — brauzerdan tutib olingan
 * (`tools/uttf-discover/`, natija: `uttf-endpoints.json`). Barchasi GET
 * va avtorizatsiyasiz 200 qaytaradi.
 *
 * Konvert: { success, timestamp, data, paging: { page, size, total } }
 */

const BASE = process.env.UTTF_BASE_URL ?? 'https://uttf.uz';
const API = `${BASE}/api/table-tennis`;

/** So'rovlar orasidagi eng kam tanaffus — manba saytga yuk bo'lmasin */
const MIN_GAP_MS = Number(process.env.UTTF_MIN_GAP_MS ?? 250);

export interface Envelope<T> {
  success: boolean;
  timestamp: string;
  data: T;
  paging?: { page: number; size: number; total: number };
  totalCount?: number;
}

export type Locale = 'uz' | 'ru' | 'en';

export class UttfClient {
  private readonly log = new Logger(UttfClient.name);
  private lastCall = 0;

  constructor(private readonly locale: Locale = 'uz') {}

  private async throttle() {
    const wait = MIN_GAP_MS - (Date.now() - this.lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
  }

  async get<T>(path: string, query: Record<string, string | number | undefined> = {}) {
    await this.throttle();
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': this.locale,
        // Halol identifikatsiya — yashirinmaymiz
        'User-Agent': 'uztt-sync/1.0 (+https://stoltennis.uz)',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`uttf ${path} -> HTTP ${res.status}`);
    }
    const body = (await res.json()) as Envelope<T>;
    if (!body || body.success !== true) {
      throw new Error(`uttf ${path} -> success=false`);
    }
    return body;
  }

  /**
   * Sahifalab to'liq ro'yxatni oladi.
   * Xavfsizlik: `maxPages` — manba kutilmaganda cheksiz sahifa bersa ham
   * sikl to'xtaydi.
   */
  async getAll<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
    { size = 100, maxPages = 100 } = {},
  ): Promise<T[]> {
    const out: T[] = [];
    for (let page = 0; page < maxPages; page++) {
      const body = await this.get<T[]>(path, { ...query, page, size });
      const rows = Array.isArray(body.data) ? body.data : [];
      out.push(...rows);
      const total = body.paging?.total ?? rows.length;
      if (out.length >= total || rows.length === 0) break;
    }
    this.log.log(`${path}: ${out.length} yozuv`);
    return out;
  }
}

/** uttf.uz sana formatlari: "19.02.2025 15:05" yoki "2025-02-19" */
export function parseUttfDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const dotted = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v);
  if (dotted) {
    return new Date(`${dotted[3]}-${dotted[2]}-${dotted[1]}T00:00:00Z`);
  }
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(v);
  if (iso) return new Date(`${iso[0]}T00:00:00Z`);
  return null;
}
