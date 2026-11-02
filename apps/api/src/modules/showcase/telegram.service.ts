import { join } from 'path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { ShowcaseService } from './showcase.service';
import {
  CARD_SIZE,
  renderCardPng,
  type CardData,
  type CardFormat,
  type CardPlayer,
} from './telegram.card';

const STAGE_UZ: Record<string, string> = {
  FINAL: 'FINAL',
  SEMIFINAL: 'YARIM FINAL',
  QUARTERFINAL: 'CHORAK FINAL',
  ROUND_OF_16: '1/8 FINAL',
  ROUND_OF_32: '1/16 FINAL',
  ROUND_1: '1-BOSQICH',
  GROUP: 'GURUH BOSQICHI',
};

const sgn = (d: number) => (d > 0 ? '+' : '') + d;

/**
 * Telegram guruhiga o'yin natijasi: avval matn, keyin ikki format rasm
 * (1920x1080 va 1080x1920). Token/chat `.env` da (TELEGRAM_BOT_TOKEN,
 * TELEGRAM_CHAT_ID) — kodda ham, logda ham HECH QACHON chiqmaydi.
 * Xatolar o'yin hisobiga TA'SIR QILMAYDI: hamma narsa fonda va try/catch ichida.
 */
@Injectable()
export class TelegramService {
  private readonly log = new Logger('Telegram');
  private readonly recent = new Map<string, number>();
  /** Yuborilgan natijalar: matchId + g'olib + geymlar hisobi (undo -> qayta tugatish bir xil natijani takrorlamasin) */
  private readonly sentResults = new Set<string>();
  /**
   * Ketma-ket navbat (Telegram chegarasiga urilmaslik uchun). Cheklangan: TELEGRAM_QUEUE_MAX dan oshsa eng eskisi
   * tashlanadi; navbatda 10 daqiqadan ortiq turgan e'lon yuborilmaydi (Telegram sekin bo'lsa soatlab kechikmasin).
   */
  private readonly jobs: Array<{ label: string; at: number; run: () => Promise<void> }> = [];
  private draining = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly showcase: ShowcaseService,
  ) {}

  private get token() {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }
  private get chatId() {
    return this.config.get<string>('TELEGRAM_CHAT_ID') ?? '';
  }
  get enabled() {
    return !!this.token && !!this.chatId;
  }

  /** O'yin tugaganda chaqiriladi — javobni kutmaydi, xato otmaydi, dublikat yubormaydi */
  notifyFinished(matchId: string, seq: number): void {
    if (!this.enabled || !this.eventOn('match')) return;
    const key = `${matchId}:${seq}`;
    if (this.recent.has(key)) return;
    this.recent.set(key, Date.now());
    if (this.recent.size > 500) {
      const first = this.recent.keys().next().value;
      if (first !== undefined) this.recent.delete(first);
    }
    // Navbat: ko'p stol bir vaqtda tugasa, Telegram chegarasiga urilmaslik uchun ketma-ket
    this.enqueue(`match ${matchId}`, () => this.sendMatch(matchId));
  }

  private enqueue(label: string, run: () => Promise<void>): void {
    const max = Number(this.config.get<string>('TELEGRAM_QUEUE_MAX') ?? 50) || 50;
    while (this.jobs.length >= max) {
      const dropped = this.jobs.shift();
      this.log.warn(`Navbat to'la (${max}) — eng eski e'lon tashlab yuborildi: ${dropped?.label}`);
    }
    this.jobs.push({ label, at: Date.now(), run });
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.jobs.length) {
        const job = this.jobs.shift()!;
        if (Date.now() - job.at > TelegramService.MAX_AGE_MS) {
          this.log.warn(`Eskirgan e'lon yuborilmadi (${Math.round((Date.now() - job.at) / 60_000)} daqiqa navbatda): ${job.label}`);
          continue;
        }
        try {
          await job.run();
        } catch (e) {
          this.log.warn(`Yuborilmadi (${job.label}): ${this.safe(e)}`);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /** Navbatda shundan uzoq turgan e'lon yuborilmaydi */
  static readonly MAX_AGE_MS = 10 * 60_000;

  /** Natija kaliti: o'yin + g'olib + geymlar hisobi */
  static resultKey(r: { matchId: string; winnerSlot: 1 | 2 | null; games: Array<[number, number]> }): string {
    return `${r.matchId}|${r.winnerSlot ?? '-'}|${r.games.map((g) => `${g[0]}-${g[1]}`).join(',')}`;
  }

  // ==================== UMUMIY E'LONLAR (yangilik, musobaqa, setka, reyting, arizalar) ====================

  private get adminChatId() {
    return this.config.get<string>('TELEGRAM_ADMIN_CHAT_ID') ?? '';
  }
  /** Qaysi turdagi e'lonlar yuboriladi: TELEGRAM_EVENTS="match,news,tournament,draw,ranking,admin" (standart: hammasi) */
  private eventOn(kind: string) {
    const list = (this.config.get<string>('TELEGRAM_EVENTS') ?? 'match,news,tournament,draw,ranking,admin')
      .split(',')
      .map((x) => x.trim());
    return list.includes(kind);
  }
  /** Saytga havola uchun asos (kanal postida bosiladigan) */
  siteUrl(): string {
    return (this.config.get<string>('PUBLIC_SITE_URL') ?? this.config.get<string>('WEB_ORIGIN') ?? '').split(',')[0].trim().replace(/\/$/, '');
  }

  /**
   * Matnli e'lon (ixtiyoriy rasm bilan). Javobni kutdirmaydi, hech qachon xato otmaydi.
   * `admin` turi — alohida TELEGRAM_ADMIN_CHAT_ID ga (yo'q bo'lsa yuborilmaydi: ichki ma'lumot ommaviy kanalga chiqmasin).
   * Shaxsiy ma'lumot (email, telefon, parol) HECH QACHON yuborilmaydi — chaqiruvchi shuni ta'minlaydi.
   */
  announce(kind: 'news' | 'tournament' | 'draw' | 'ranking' | 'admin', text: string, opts: { photo?: string | null } = {}): void {
    if (!this.enabled || !this.eventOn(kind)) return;
    const chat = kind === 'admin' ? this.adminChatId : this.chatId;
    if (!chat) return;
    const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 3800);
    this.enqueue(`e'lon ${kind}`, async () => {
      const jpeg = opts.photo ? await this.localJpeg(opts.photo) : null;
      if (jpeg) await this.sendPhotoTo(chat, jpeg, clean.slice(0, 1000), 'image/jpeg');
      else await this.sendMessageTo(chat, clean);
    });
  }

  /** Yangi musobaqa e'loni */
  announceTournament(slug: string, name: string, start: string | Date, end: string | Date, place: string): void {
    const d = (x: string | Date) => new Date(x).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Tashkent' });
    this.announce('tournament', `🏆 Yangi musobaqa: ${name}\n📅 ${d(start)} — ${d(end)}${place ? `\n📍 ${place}` : ''}\n\n${this.siteUrl()}/musobaqalar/${slug}`);
  }

  /** Setka yoki guruhlar tayyor bo'lganda */
  announceDraw(tournamentCategoryId: string, what: 'bracket' | 'groups'): void {
    if (!this.enabled || !this.eventOn('draw')) return;
    void this.prisma.tournamentCategory
      .findUnique({
        where: { id: tournamentCategoryId },
        select: { gender: true, ageCategory: { select: { name: true } }, tournament: { select: { slug: true, name: true } }, _count: { select: { registrations: true } } },
      })
      .then((c) => {
        if (!c) return;
        const g = c.gender === 'MALE' ? 'erkaklar' : c.gender === 'FEMALE' ? 'ayollar' : '';
        this.announce('draw', `📋 ${what === 'groups' ? 'Guruhlar' : 'Setka'} tayyor: ${c.tournament.name}\n${[c.ageCategory?.name, g].filter(Boolean).join(' · ')} — ${c._count.registrations} ishtirokchi\n\n${this.siteUrl()}/musobaqalar/${c.tournament.slug}`);
      })
      .catch((e: unknown) => this.log.warn(`Setka e'loni: ${this.safe(e)}`));
  }

  /** Reyting yangilandi: erkak va ayollar bo'yicha birinchi 3 o'rin */
  announceRanking(label: string): void {
    if (!this.enabled || !this.eventOn('ranking')) return;
    const top = (gender: 'MALE' | 'FEMALE') =>
      this.prisma.player.findMany({ where: { status: 'ACTIVE', gender }, orderBy: [{ rankingPoints: 'desc' }, { lastName: 'asc' }], take: 3, select: { firstName: true, lastName: true, rankingPoints: true } });
    void Promise.all([top('MALE'), top('FEMALE')])
      .then(([m, f]) => {
        const fmt = (r: Array<{ firstName: string; lastName: string; rankingPoints: number }>) => r.map((p, i) => `${i + 1}. ${p.lastName} ${p.firstName} — ${p.rankingPoints}`).join('\n');
        this.announce('ranking', `📊 Reyting yangilandi (${label})\n\n♂ Erkaklar\n${fmt(m)}\n\n♀ Ayollar\n${fmt(f)}\n\n${this.siteUrl()}/reyting`);
      })
      .catch((e: unknown) => this.log.warn(`Reyting e'loni: ${this.safe(e)}`));
  }

  /** Faqat o'zimizning yuklangan rasmlar (/uploads/...) — tashqi manzil yoki yo'l hiylasi (..) o'tmaydi */
  private async localJpeg(url: string): Promise<Buffer | null> {
    const m = /^\/uploads\/(images|players)\/[\w.-]+\.(webp|png|jpe?g)$/.exec(url);
    if (!m) return null;
    try {
      const file = join(process.cwd(), 'uploads', 'public', url.slice('/uploads/'.length));
      return await sharp(file).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      return null;
    }
  }

  async sendTest(matchId?: string) {
    if (!this.enabled) {
      return { ok: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID sozlanmagan' };
    }
    let id = matchId;
    if (!id) {
      const last = await this.prisma.match.findFirst({
        where: { status: 'FINISHED', winnerId: { not: null } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      id = last?.id;
    }
    if (!id) throw new NotFoundException('Tugagan o\'yin yo\'q');
    await this.sendMatch(id, true);
    return { ok: true, matchId: id };
  }

  // ---------------------------------------------------------------

  private safe(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    const t = this.token;
    return t ? msg.split(t).join('***') : msg;
  }

  private async sendMatch(matchId: string, force = false) {
    this.showcase.forget(matchId); // undo -> qayta tugatishda 15 s keshdagi eski natija olinmasin
    const res = await this.showcase.rating(matchId);
    // Bir xil natija (masalan, oxirgi ochko bekor qilinib, xuddi shunday qayta kiritilgan) ikkinchi marta yuborilmaydi
    const key = TelegramService.resultKey(res);
    if (!force && this.sentResults.has(key)) return;
    const data = await this.cardData(res);
    const text = this.text(res);
    await this.sendMessage(text);
    this.sentResults.add(key);
    if (this.sentResults.size > 1000) {
      const first = this.sentResults.values().next().value;
      if (first !== undefined) this.sentResults.delete(first);
    }
    for (const f of ['h', 'v'] as CardFormat[]) {
      const png = await renderCardPng(data, f);
      const { w, h } = CARD_SIZE[f];
      await this.sendPhoto(png, `${text.split('\n')[0]}\n(${w}×${h})`);
    }
  }

  private text(r: Awaited<ReturnType<ShowcaseService['rating']>>): string {
    const [a, b] = r.players;
    const head = [
      r.tournamentName,
      r.tableNumber ? `Stol ${r.tableNumber}` : '',
      STAGE_UZ[r.stage] ?? r.stage,
    ]
      .filter(Boolean)
      .join(' · ');
    let t = `\u{1F3D3} ${head}\n\n${a.firstName} ${a.lastName}  ${a.sets} – ${b.sets}  ${b.firstName} ${b.lastName}`;
    if (r.games.length) t += `\nGeymlar: ${r.games.map((g) => `${g[0]}-${g[1]}`).join(', ')}`;
    const w = r.players.find((p) => p.won);
    if (w) t += `\n\u{1F3C6} G'olib: ${w.firstName} ${w.lastName}`;
    t += '\n\n\u{1F4C8} Reyting:';
    for (const p of r.players) {
      t += `\n${p.won ? '▲' : '▼'} ${p.firstName} ${p.lastName}: ${p.before} → ${p.after} (${sgn(p.delta)})`;
    }
    return t;
  }

  private async cardData(
    r: Awaited<ReturnType<ShowcaseService['rating']>>,
  ): Promise<CardData> {
    const players = await Promise.all(
      r.players.map(async (p): Promise<CardPlayer> => ({
        name: p.lastName,
        given: p.firstName,
        country: p.countryCode,
        photo: await this.photo(p.photoUrl),
        won: p.won,
        sets: p.sets,
        before: p.before,
        after: p.after,
        delta: p.delta,
        rankBefore: p.rankBefore,
        rankAfter: p.rankAfter,
      })),
    );
    const blank: CardPlayer = { name: '-', given: '', country: '', photo: null, won: false, sets: 0 };
    return {
      title: r.tournamentName,
      subtitle: [r.tableNumber ? `Table ${r.tableNumber}` : '', STAGE_UZ[r.stage] ?? r.stage]
        .filter(Boolean)
        .join(' - '),
      players: [players[0] ?? blank, players[1] ?? blank],
      games: r.games,
      rating: true,
    };
  }

  /** Rasmni saytdan olib 440x440 jpeg data-URI qilamiz. Faqat o'zimizning nisbiy manzillar (SSRF yo'q). */
  private async photo(url: string | null): Promise<string | null> {
    if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
    const base = (this.config.get<string>('WEB_ORIGIN') ?? '').split(',')[0]?.trim();
    if (!base) return null;
    try {
      const res = await fetch(base + url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 6 * 1024 * 1024) return null;
      const jpg = await sharp(buf).rotate().resize(440, 440, { fit: 'cover', position: 'top' }).jpeg({ quality: 82 }).toBuffer();
      return `data:image/jpeg;base64,${jpg.toString('base64')}`;
    } catch {
      return null; // rasm bo'lmasa bosh harflar chiqadi
    }
  }

  private api(method: string) {
    const host = this.config.get<string>('TELEGRAM_API_BASE') ?? 'https://api.telegram.org';
    return `${host}/bot${this.token}/${method}`;
  }

  private async call(method: string, body: FormData | string, headers?: Record<string, string>) {
    let lastErr = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(this.api(method), {
          method: 'POST',
          body,
          headers,
          signal: AbortSignal.timeout(30_000),
        });
        if (res.ok) return;
        const j = (await res.json().catch(() => ({}))) as { description?: string; parameters?: { retry_after?: number } };
        lastErr = `${method} ${res.status} ${j.description ?? ''}`;
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, Math.min(20, j.parameters?.retry_after ?? 3) * 1000));
        } else if (res.status < 500) break; // 4xx — qayta urinish foydasiz
      } catch (e) {
        lastErr = this.safe(e);
      }
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
    throw new Error(lastErr);
  }

  private sendMessage(text: string) {
    return this.sendMessageTo(this.chatId, text);
  }

  private sendMessageTo(chat: string, text: string) {
    return this.call(
      'sendMessage',
      JSON.stringify({ chat_id: chat, text, disable_web_page_preview: false }),
      { 'Content-Type': 'application/json' },
    );
  }

  private sendPhoto(png: Buffer, caption: string) {
    return this.sendPhotoTo(this.chatId, png, caption, 'image/png');
  }

  private sendPhotoTo(chat: string, img: Buffer, caption: string, type: string) {
    const fd = new FormData();
    fd.append('chat_id', chat);
    fd.append('caption', caption.slice(0, 1000));
    fd.append('photo', new Blob([new Uint8Array(img)], { type }), type === 'image/png' ? 'result.png' : 'photo.jpg');
    return this.call('sendPhoto', fd);
  }
}
