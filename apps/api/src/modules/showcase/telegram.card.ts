import sharp from 'sharp';

/**
 * Telegram uchun natija kartochkasi: SVG -> PNG (sharp/librsvg, brauzer kerak emas).
 * Ikki format: 1920x1080 (gorizontal) va 1080x1920 (vertikal).
 * Shrift: serverda DejaVu Sans bo'lishi shart (Dockerfile: font-dejavu).
 */
export type CardFormat = 'h' | 'v';

export interface CardPlayer {
  name: string;
  given: string;
  country: string;
  /** data: URI (jpeg) yoki null — bosh harflar chiziladi */
  photo: string | null;
  won: boolean;
  sets: number;
  before?: number;
  after?: number;
  delta?: number;
  rankBefore?: number;
  rankAfter?: number;
}

export interface CardData {
  title: string;
  subtitle: string;
  players: [CardPlayer, CardPlayer];
  games: Array<[number, number]>;
  /** true bo'lsa reyting yangilanishi, aks holda oddiy natija */
  rating: boolean;
}

export const CARD_SIZE: Record<CardFormat, { w: number; h: number }> = {
  h: { w: 1920, h: 1080 },
  v: { w: 1080, h: 1920 },
};

const FONT = "'DejaVu Sans','Liberation Sans',Arial,sans-serif";

export const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Matn kengligiga sig'ishi uchun shrift o'lchamini kamaytirish (DejaVu Bold ~0.68em/belgi) */
const fit = (text: string, base: number, maxW: number, k = 0.68) =>
  Math.max(14, Math.min(base, Math.floor(maxW / Math.max(1, text.length * k))));

const fmt2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '') + fmt2(Math.abs(d));
const initials = (p: CardPlayer) =>
  esc(((p.given[0] ?? '') + (p.name[0] ?? '')).toUpperCase());

function playerBlock(p: CardPlayer, idx: number, x: number, y: number, size: number, showRating: boolean) {
  const clip = `clip${idx}`;
  const plateY = y + size - 8;
  const plateW = size + 70;
  const px = x - 35;
  const nameSize = fit(p.name, 66, plateW - 96);
  const givenSize = fit(p.given, 30, plateW - 50, 0.7);
  const pic = p.photo
    ? `<image href="${p.photo}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
    : `<text x="${x + size / 2}" y="${y + size / 2 + size * 0.14}" text-anchor="middle" font-size="${size * 0.38}" font-weight="700" fill="#ffffff" fill-opacity="0.55">${initials(p)}</text>`;
  const chipColor = (p.delta ?? 0) > 0 ? '#1fa354' : (p.delta ?? 0) < 0 ? '#d23a3a' : '#555a5f';
  const strip = showRating && p.delta !== undefined
    ? `<text x="${x + size / 2}" y="${plateY + 160}" text-anchor="middle" font-size="44" font-weight="700" fill="${(p.delta ?? 0) > 0 ? '#7dff9b' : (p.delta ?? 0) < 0 ? '#ff8b8b' : '#cfd3d6'}">${sign(p.delta)}</text>`
    : `<text x="${x + size / 2}" y="${plateY + 160}" text-anchor="middle" font-size="44" font-weight="700" fill="#c6f06a">${p.sets}</text>`;
  void chipColor;
  return `
  <polygon points="${x - 40},${y + 70} ${x + size + 40},${y + 70} ${x + size + 10},${y + size - 20} ${x - 70},${y + size - 20}" fill="#ffffff" fill-opacity="0.16"/>
  <clipPath id="${clip}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="34"/></clipPath>
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="34" fill="#1d6a37"/>
  ${pic}
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="34" fill="none" stroke="#ffffff" stroke-width="5"/>
  ${p.won ? `<rect x="${x + size / 2 - 120}" y="${y - 44}" width="240" height="44" fill="#c6f06a"/><text x="${x + size / 2}" y="${y - 12}" text-anchor="middle" font-size="26" font-weight="700" letter-spacing="6" fill="#0c3b1f">WINNER</text>` : ''}
  <polygon points="${px + 22},${plateY} ${px + plateW},${plateY} ${px + plateW - 22},${plateY + 112} ${px},${plateY + 112}" fill="#ffffff"/>
  <text x="${x + size / 2}" y="${plateY + 40}" text-anchor="middle" font-size="${givenSize}" font-style="italic" font-weight="700" letter-spacing="3" fill="#444444">${esc(p.given.toUpperCase())}</text>
  <text x="${x + size / 2}" y="${plateY + 98}" text-anchor="middle" font-size="${nameSize}" font-style="italic" font-weight="700" fill="#111111">${esc(p.name.toUpperCase())}</text>
  <polygon points="${px + 50},${plateY + 118} ${px + plateW - 20},${plateY + 118} ${px + plateW - 40},${plateY + 176} ${px + 30},${plateY + 176}" fill="#111111" fill-opacity="0.93"/>
  <text x="${x + 38}" y="${plateY + 154}" font-size="24" font-weight="700" fill="#ffffff" fill-opacity="0.8">${esc(p.country)}</text>
  ${strip}`;
}

function panel(d: CardData, x: number, y: number, w: number) {
  const [a, b] = d.players;
  const rows: string[] = [];
  let ry = y + 250;
  const RH = 88;
  const row = (left: string, label: string, right: string, odd: boolean, lc = '#ffffff', rc = '#ffffff', fs = 52) => {
    rows.push(`<rect x="${x}" y="${ry}" width="${w}" height="${RH}" fill="${odd ? '#26272a' : '#1c1d20'}"/>
      <text x="${x + w * 0.2}" y="${ry + 60}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${lc}">${left}</text>
      <text x="${x + w / 2}" y="${ry + 54}" text-anchor="middle" font-size="22" font-weight="700" letter-spacing="4" fill="#9a9ea5">${label}</text>
      <text x="${x + w * 0.8}" y="${ry + 60}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${rc}">${right}</text>`);
    ry += RH;
  };
  if (d.rating) {
    row(fmt2(a.after ?? 0), 'RATING', fmt2(b.after ?? 0), false);
    row(sign(a.delta ?? 0), '+ / −', sign(b.delta ?? 0), true,
      (a.delta ?? 0) > 0 ? '#7dff9b' : (a.delta ?? 0) < 0 ? '#ff8b8b' : '#cfd3d6',
      (b.delta ?? 0) > 0 ? '#7dff9b' : (b.delta ?? 0) < 0 ? '#ff8b8b' : '#cfd3d6');
    const rk = (p: CardPlayer) => {
      if (!p.rankBefore || !p.rankAfter || p.rankBefore === p.rankAfter) return `#${p.rankAfter ?? '-'}`;
      return `#${p.rankBefore} ${p.rankAfter < p.rankBefore ? '▲' : '▼'} #${p.rankAfter}`;
    };
    row(rk(a), 'RANK', rk(b), false,
      a.rankAfter && a.rankBefore && a.rankAfter < a.rankBefore ? '#7dff9b' : a.rankAfter && a.rankBefore && a.rankAfter > a.rankBefore ? '#ff8b8b' : '#ffffff',
      b.rankAfter && b.rankBefore && b.rankAfter < b.rankBefore ? '#7dff9b' : b.rankAfter && b.rankBefore && b.rankAfter > b.rankBefore ? '#ff8b8b' : '#ffffff', 40);
  } else {
    d.games.slice(0, 7).forEach((g, i) =>
      row(String(g[0]), `GAME ${i + 1}`, String(g[1]), i % 2 === 1, g[0] > g[1] ? '#c6f06a' : '#ffffff', g[1] > g[0] ? '#c6f06a' : '#ffffff'),
    );
  }
  const h = ry - y + 24;
  const title = d.rating ? 'RATING UPDATE' : 'MATCH RESULT';
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1c1d20"/>
  <rect x="${x}" y="${y}" width="${w}" height="12" fill="#c6f06a"/>
  <polygon points="${x + w * 0.2},${y - 56} ${x + w * 0.8},${y - 56} ${x + w * 0.8 - 14},${y + 12} ${x + w * 0.2 - 14},${y + 12}" fill="#c6f06a"/>
  <text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="${fit(d.title, 34, w * 0.58, 0.72)}" font-weight="700" font-style="italic" fill="#0c3b1f">${esc(d.title.toUpperCase())}</text>
  <text x="${x + w / 2}" y="${y + 100}" text-anchor="middle" font-size="68" font-weight="700" font-style="italic" fill="#ffffff">${title}</text>
  <text x="${x + w / 2}" y="${y + 150}" text-anchor="middle" font-size="${fit(d.subtitle, 28, w - 80, 0.62)}" font-style="italic" letter-spacing="2" fill="#b5b8bd">${esc(d.subtitle.toUpperCase())}</text>
  <text x="${x + w / 2}" y="${y + 225}" text-anchor="middle" font-size="64" font-weight="700" fill="#c6f06a">${a.sets} – ${b.sets}</text>
  ${rows.join('')}`;
}

export function buildCardSvg(d: CardData, f: CardFormat): string {
  const { w, h } = CARD_SIZE[f];
  const size = 440;
  const [a, b] = d.players;
  let body: string;
  if (f === 'h') {
    body = playerBlock(a, 0, 100, 200, size, d.rating) + playerBlock(b, 1, w - 100 - size, 200, size, d.rating) + panel(d, 595, 200, 730);
  } else {
    body = playerBlock(a, 0, 60, 330, size, d.rating) + playerBlock(b, 1, w - 60 - size, 330, size, d.rating) + panel(d, 20, 1180, w - 40);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a5a2a"/><stop offset="0.5" stop-color="#0d6a31"/><stop offset="1" stop-color="#06301a"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${body}
</svg>`;
}

/** SVG -> PNG (aniq 1920x1080 yoki 1080x1920) */
export function renderCardPng(d: CardData, f: CardFormat): Promise<Buffer> {
  const { w, h } = CARD_SIZE[f];
  return sharp(Buffer.from(buildCardSvg(d, f)), { density: 72 })
    .resize(w, h)
    .png({ compressionLevel: 8 })
    .toBuffer();
}
