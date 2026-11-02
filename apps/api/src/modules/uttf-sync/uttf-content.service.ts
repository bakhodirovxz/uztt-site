import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeRegion } from '../../common/regions';
import { UttfClient, parseUttfDate, type Locale } from './uttf-client';
import type { SyncResult } from './uttf-sync.service';

const BASE = process.env.UTTF_BASE_URL ?? 'https://uttf.uz';
const IMAGES = join(process.cwd(), 'uploads', 'public', 'images');
const PLAYERS = join(process.cwd(), 'uploads', 'public', 'players');

/** Bitta so'rov ichidagi ish vaqti chegarasi: host nginx /api/ uchun 60 s kutadi — undan ancha oldin javob qaytaramiz */
const BUDGET_MS = Number(process.env.UTTF_SYNC_BUDGET_MS ?? 40_000);
/** Bir chaqiruvda nechta o'yinchi rasmi yuklanadi (qolgani `remaining` da — qayta ishga tushiriladi) */
export const PHOTO_LIMIT_MAX = 50;
const PHOTO_LIMIT_DEFAULT = 30;
/** Bir chaqiruvda nechta yangilik yoziladi (muqova yuklash bilan) */
export const NEWS_WRITE_MAX = 25;
/** Manba ro'yxatlari (yangiliklar, sportchilar) qisqa muddat keshlanadi — qayta chaqiruv tez bo'lsin */
const LIST_TTL_MS = 10 * 60_000;
/** Rasm hajmi chegarasi */
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;

type WithRemaining = SyncResult & { remaining: number; perRun?: number };

/** Faqat jpeg/png/webp — sehrli baytlar bo'yicha (Content-Type'ga ishonmaymiz). SVG/TIFF/HEIF va boshqalar o'tmaydi. */
export function imageFormatOf(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Javob tanasini chegaralab o'qiydi: Content-Length katta bo'lsa — o'qimasdan rad etadi,
 * yo'q bo'lsa oqim bo'yicha sanaydi va chegaradan oshgan zahoti uzadi (xotira to'lib ketmasin).
 */
export async function readLimited(res: Response, max: number): Promise<Buffer | null> {
  const len = Number(res.headers.get('content-length') ?? NaN);
  if (Number.isFinite(len) && len > max) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

interface UttfNews { id: number | string; tag: string | null; title: string | null; description: string | null; photoId: string | null; createdAt: string | null; status?: string | number | null }
interface UttfClub {
  id: number; name: string | null; shortName?: string | null; type?: string | null; regionName: string | null; districtName: string | null;
  address: string | null; latitude: string | number | null; longitude: string | number | null; phoneNumber: string | null;
  coachName: string | null; clubManagerName: string | null; numberOfIttfTables: number | null; photoId: string | null; deleted?: number | null;
}
interface UttfSportsman { pinfl: string | null; photoId: string | null }

const emptyResult = (scope: string, dryRun: boolean): SyncResult => ({
  scope, dryRun, fetched: 0, created: 0, updated: 0, skipped: 0, translations: 0, warnings: [], sample: [],
});

export function slugOf(text: string, id: string | number): string {
  const base = text.toLowerCase().replace(/[‘’'`ʻʼ]/g, '').replace(/[^a-z0-9Ѐ-ӿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
  return `${base || 'item'}-${id}`;
}

/** Manba "нулл"/"null" kabi axlat qiymatlarni bo'sh deb hisoblaymiz */
export function clean(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || /^(нулл|null|undefined|-|—)(\s+(нулл|null))*$/i.test(s)) return null;
  return s;
}

@Injectable()
export class UttfContentService {
  private readonly log = new Logger(UttfContentService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Manba ro'yxatlari keshi (kalit -> qatorlar) */
  private readonly lists = new Map<string, { at: number; rows: unknown[] }>();
  /** Yaqinda yuklab bo'lmagan rasmlar (photoId -> vaqt): 1 soat davomida qayta urinilmaydi */
  private readonly failed = new Map<string, number>();

  private recentlyFailed(photoId: string): boolean {
    const at = this.failed.get(photoId);
    if (at === undefined) return false;
    if (Date.now() - at > 60 * 60_000) {
      this.failed.delete(photoId);
      return false;
    }
    return true;
  }

  private async listing<T>(key: string, load: () => Promise<T[]>): Promise<T[]> {
    const hit = this.lists.get(key);
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.rows as T[];
    const rows = await load();
    if (rows.length) this.lists.set(key, { at: Date.now(), rows });
    return rows;
  }

  /**
   * uttf.uz fayli → bizning WebP (sharp qayta kodlaydi). Xato bo'lsa null.
   * Xavfsizlik: yo'naltirish (redirect) qabul qilinmaydi — so'rov faqat UTTF_BASE_URL hostiga boradi;
   * hajm oqim bo'yicha cheklanadi; faqat jpeg/png/webp (sehrli baytlar + sharp metadata) qabul qilinadi.
   */
  private async fetchImage(photoId: string | null, kind: 'cover' | 'logo' | 'player'): Promise<{ url: string; thumb?: string } | null> {
    if (!photoId || !/^[\w-]{8,64}$/.test(photoId)) return null;
    try {
      const res = await fetch(`${BASE}/api/table-tennis/files/get-file/${photoId}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        headers: { 'User-Agent': 'uztt-sync/1.0 (+https://stoltennis.uz)' },
      });
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        return null;
      }
      const buf = await readLimited(res, IMAGE_MAX_BYTES);
      if (!buf || buf.length < 500) return null;
      const fmt = imageFormatOf(buf);
      if (!fmt) {
        this.log.warn(`rasm ${photoId}: ruxsat etilmagan format`);
        return null;
      }
      const opts = { limitInputPixels: 40_000_000 };
      const meta = await sharp(buf, opts).metadata();
      if (meta.format !== fmt) return null;
      const name = `uttf-${photoId.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
      if (kind === 'player') {
        mkdirSync(PLAYERS, { recursive: true });
        await sharp(buf, opts).rotate().resize(600, 800, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toFile(join(PLAYERS, `${name}.webp`));
        await sharp(buf, opts).rotate().resize(96, 96, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 70 }).toFile(join(PLAYERS, `${name}-thumb.webp`));
        return { url: `/uploads/players/${name}.webp`, thumb: `/uploads/players/${name}-thumb.webp` };
      }
      mkdirSync(IMAGES, { recursive: true });
      await sharp(buf, opts).rotate().resize(kind === 'logo' ? 400 : 1600, kind === 'logo' ? 400 : 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(IMAGES, `${name}.webp`));
      return { url: `/uploads/images/${name}.webp` };
    } catch (e) {
      this.log.warn(`rasm ${photoId}: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Yangiliklar — BARCHA eskilari ham (sahifalab), uch tilda: har til uchun alohida so'rov (Accept-Language).
   * Kalit: NewsArticle.externalId = uttf yangilik ID si. Bir tilda matn boshqa til bilan bir xil chiqsa
   * (manba o'sha tilda tarjima bermagan) — takroriy tarjima yaratilmaydi. Mavjud (tahrirlangan) matnlar ustiga yozilmaydi.
   */
  async syncNews({ dryRun = true }: { dryRun?: boolean } = {}) {
    const deadline = Date.now() + BUDGET_MS;
    const result: WithRemaining = { ...emptyResult('news', dryRun), remaining: 0 };
    type Item = { id: number; photoId: string | null; createdAt: string | null; tr: Partial<Record<Locale, { title: string; body: string }>> };
    const items = new Map<number, Item>();
    const locales: Locale[] = ['uz', 'ru', 'en'];
    for (const loc of locales) {
      let rows: UttfNews[] = [];
      try {
        rows = await this.listing(`news:${loc}`, () => new UttfClient(loc).getAll<UttfNews>('/news/index', {}, { size: 50, maxPages: 60 }));
      } catch (e) {
        result.warnings.push(`${loc}: yangiliklar olinmadi — ${(e as Error).message}`);
        if (loc === 'uz') return result;
        continue;
      }
      for (const n of rows) {
        const id = Number(n.id);
        if (!Number.isInteger(id) || String(n.status ?? '1') === '0') continue;
        const title = clean(n.title) ?? clean(n.tag);
        const body = clean(n.description);
        if (!title || !body) continue;
        const it = items.get(id) ?? { id, photoId: n.photoId, createdAt: n.createdAt, tr: {} };
        it.tr[loc] = { title, body };
        items.set(id, it);
      }
    }
    result.fetched = items.size;
    if (!items.size) { result.warnings.push("Manba 0 ta yangilik qaytardi — to'xtatildi"); return result; }

    const all = [...items.values()].sort((a, b) => a.id - b.id);
    let writes = 0;
    for (let idx = 0; idx < all.length; idx++) {
      const it = all[idx];
      // Bir so'rovda cheklangan ish: yozuvlar soni yoki vaqt tugasa — qolgani keyingi chaqiruvga
      if ((!dryRun && writes >= NEWS_WRITE_MAX) || Date.now() > deadline) {
        result.remaining = all.length - idx;
        result.warnings.push(`To'xtatildi: ${result.remaining} ta yangilik hali ko'rib chiqilmadi — qayta ishga tushiring`);
        break;
      }
      // Boshqa til matni uz bilan bir xil bo'lsa — tarjima emas
      const uz = it.tr.uz;
      const trs = (Object.entries(it.tr) as Array<[Locale, { title: string; body: string }]>).filter(([l, t]) => l === 'uz' || !uz || t.title !== uz.title);
      if (!trs.length) { result.skipped++; continue; }
      const prev = await this.prisma.newsArticle.findUnique({ where: { externalId: it.id }, include: { translations: { select: { locale: true } } } });
      const have = new Set(prev?.translations.map((t) => t.locale));
      const missing = trs.filter(([l]) => !have.has(l));
      if (prev && !missing.length) { result.skipped++; continue; }
      if (!dryRun) {
        const rows = missing.map(([locale, t]) => ({
          locale, title: t.title, slug: slugOf(t.title, it.id), excerpt: t.body.slice(0, 200), body: t.body,
        }));
        // slug (locale, slug) unikal — to'qnashsa id qo'shib ajratiladi
        for (const r of rows) {
          if (await this.prisma.newsTranslation.findFirst({ where: { locale: r.locale, slug: r.slug }, select: { id: true } })) r.slug = `${r.slug}-n${it.id}`;
        }
        if (prev) {
          await this.prisma.newsTranslation.createMany({ data: rows.map((r) => ({ ...r, articleId: prev.id })) });
        } else {
          const cover = await this.fetchImage(it.photoId, 'cover');
          await this.prisma.newsArticle.create({
            data: {
              externalId: it.id,
              status: 'PUBLISHED',
              publishedAt: parseUttfDate(it.createdAt) ?? new Date(),
              coverImageUrl: cover?.url ?? null,
              translations: { create: rows },
            },
          });
        }
        result.translations += rows.length;
        writes++;
      }
      if (prev) result.updated++; else result.created++;
      if (result.sample.length < 8) result.sample.push({ action: prev ? 'update' : 'create', id: String(it.id), name: (it.tr.uz ?? trs[0][1]).title });
    }
    return result;
  }

  /**
   * Manba bilan aloqa va javob shaklini tekshiradi (hech narsa yozmaydi): har bo'lim bo'yicha ulanish, soni va
   * maydon nomlari. Shaxsiy ma'lumot (ism, pinfl) qaytarilmaydi — faqat maydon nomlari.
   */
  async probe() {
    const c = new UttfClient('uz');
    const targets: Array<[string, string, Record<string, string | number>]> = [
      ['news', '/news/index', { page: 0, size: 2 }],
      ['clubs', '/club/get-all', { page: 0, size: 2 }],
      ['tournaments', '/tournaments/index', { page: 0, size: 2 }],
      ['sportsman', '/sportsman/index', { page: 0, size: 1 }],
    ];
    const out: Array<{ name: string; ok: boolean; total?: number; keys?: string[]; error?: string }> = [];
    for (const [name, path, q] of targets) {
      try {
        const body = await c.get<unknown[]>(path, q);
        const rows = Array.isArray(body.data) ? body.data : [];
        out.push({ name, ok: true, total: body.paging?.total ?? body.totalCount ?? rows.length, keys: rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0] as object) : [] });
      } catch (e) {
        out.push({ name, ok: false, error: (e as Error).message });
      }
    }
    return out;
  }

  /** Klublar jadvali. Kalit: Club.externalId. Mavjudlari yangilanadi, o'chirilmaydi. */
  async syncClubs({ dryRun = true }: { dryRun?: boolean } = {}) {
    const deadline = Date.now() + BUDGET_MS;
    const result: WithRemaining = { ...emptyResult('clubs', dryRun), remaining: 0 };
    const rows = await this.listing('clubs', () => new UttfClient('uz').getAll<UttfClub>('/club/get-all', {}, { size: 200, maxPages: 30 }));
    result.fetched = rows.length;
    if (!rows.length) { result.warnings.push("Manba 0 ta klub qaytardi — to'xtatildi"); return result; }

    for (let idx = 0; idx < rows.length; idx++) {
      const c = rows[idx];
      if (Date.now() > deadline) {
        result.remaining = rows.length - idx;
        result.warnings.push(`Vaqt chegarasi: ${result.remaining} ta klub qoldi — qayta ishga tushiring (yangilanganlar takrorlanmaydi)`);
        break;
      }
      const name = clean(c.name);
      if (!name || c.deleted === 1) { result.skipped++; continue; }
      const num = (v: string | number | null) => (v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
      const data = {
        name,
        clubType: clean(c.type),
        regionName: normalizeRegion(c.regionName) || null,
        districtName: clean(c.districtName),
        address: clean(c.address),
        latitude: num(c.latitude),
        longitude: num(c.longitude),
        phoneNumber: clean(c.phoneNumber),
        coachName: clean(c.coachName),
        managerName: clean(c.clubManagerName),
        tableCount: c.numberOfIttfTables ?? null,
      };
      const prev = await this.prisma.club.findUnique({ where: { externalId: c.id }, select: { id: true, logoUrl: true } });
      if (!dryRun) {
        const tryLogo = !prev?.logoUrl && !!c.photoId && !this.recentlyFailed(c.photoId);
        const logo = tryLogo ? await this.fetchImage(c.photoId, 'logo') : null;
        if (tryLogo && !logo) this.failed.set(c.photoId!, Date.now());
        if (prev) await this.prisma.club.update({ where: { id: prev.id }, data: { ...data, ...(logo ? { logoUrl: logo.url } : {}) } });
        else await this.prisma.club.create({ data: { ...data, slug: slugOf(name, c.id), externalId: c.id, logoUrl: logo?.url ?? null } });
      }
      if (prev) result.updated++; else result.created++;
      if (result.sample.length < 8) result.sample.push({ action: prev ? 'update' : 'create', id: String(c.id), name });
    }
    return result;
  }

  /**
   * O'yinchi rasmlari: manbadagi photoId bo'yicha yuklab, bizning WebP (+kichik nusxa) qilib saqlaydi.
   * Faqat rasmi yo'qlarga (yoki `force` bo'lsa hammaga). Bir chaqiruvda `limit` ta — qolgani `remaining` da.
   */
  async syncPhotos({ dryRun = true, limit, force = false }: { dryRun?: boolean; limit?: number; force?: boolean } = {}) {
    const deadline = Date.now() + BUDGET_MS;
    const perRun = Math.min(PHOTO_LIMIT_MAX, Math.max(1, limit ?? PHOTO_LIMIT_DEFAULT));
    const result: WithRemaining = { ...emptyResult('photos', dryRun), remaining: 0, perRun };
    const rows = await this.listing('sportsman', () => new UttfClient('uz').getAll<UttfSportsman>('/sportsman/index', {}, { size: 200, maxPages: 60 }));
    result.fetched = rows.length;
    if (!rows.length) { result.warnings.push("Manba 0 ta sportchi qaytardi — to'xtatildi"); return result; }
    const withPhoto = rows.filter((r) => r.pinfl && r.photoId);
    const players = await this.prisma.player.findMany({
      where: { licenseNumber: { in: withPhoto.map((r) => r.pinfl!) } },
      select: { id: true, licenseNumber: true, photoUrl: true },
    });
    const byLicense = new Map(players.map((p) => [p.licenseNumber!, p]));
    // Bizning o'z rasmimiz (/uploads/players) bo'lsa — tegmaymiz (foydalanuvchi yuklagan bo'lishi mumkin)
    const todo = withPhoto.filter((r) => {
      const p = byLicense.get(r.pinfl!);
      return p && !this.recentlyFailed(r.photoId!) && (force ? !p.photoUrl?.startsWith('/uploads/players/') : !p.photoUrl);
    });
    if (dryRun) {
      // Yozuvsiz: faqat qancha ish borligini ko'rsatamiz
      result.updated = todo.length;
      result.remaining = todo.length;
      return result;
    }
    let processed = 0;
    for (const r of todo.slice(0, perRun)) {
      if (Date.now() > deadline) {
        result.warnings.push('Vaqt chegarasi — qolganlari keyingi chaqiruvda');
        break;
      }
      processed++;
      const p = byLicense.get(r.pinfl!)!;
      const img = await this.fetchImage(r.photoId, 'player');
      if (!img) {
        // Yuklanmagan rasm keyingi chaqiruvlarda qayta-qayta navbat boshini egallamasin
        this.failed.set(r.photoId!, Date.now());
        result.skipped++;
        continue;
      }
      await this.prisma.player.update({ where: { id: p.id }, data: { photoUrl: img.url } });
      result.updated++;
    }
    result.remaining = Math.max(0, todo.length - processed);
    return result;
  }
}
