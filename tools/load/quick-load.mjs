#!/usr/bin/env node
/**
 * Tezkor yuklama va to'g'rilik sinovi (k6 o'rnatilmagan bo'lsa ham ishlaydi).
 *
 * O'lchaydi:
 *  1) bitta stolda ketma-ket ochko kiritish kechikishi (hakam his qiladigan vaqt),
 *  2) turli stollar bir vaqtda ishlaganda kechikish (real "N stol" holati),
 *  3) bitta o'yinga bir vaqtda N ta so'rov — row-lock yo'qolgan yangilanishga
 *     yo'l qo'ymasligi (seq aynan N ga oshishi kerak),
 *  4) ommaviy sahifa endpointlarining javob vaqti.
 *
 * Ishga tushirish (API ishlab turgan bo'lsin, seed bajarilgan):
 *   node tools/load/quick-load.mjs
 *   API_URL=http://localhost:4000 PARALLEL=20 node tools/load/quick-load.mjs
 *
 * DIQQAT: test real ochko yozadi — faqat test bazasida ishlating.
 */
const API = process.env.API_URL ?? 'http://localhost:4000';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3100';
const PARALLEL = Number(process.env.PARALLEL ?? 20);
const REFEREE = {
  email: process.env.REFEREE_EMAIL ?? 'hakam1@uztt.uz',
  password: process.env.REFEREE_PASSWORD ?? 'hakam123',
};

const pct = (sorted, q) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(REFEREE),
  });
  if (!res.ok) throw new Error(`Hakam kira olmadi: ${res.status}`);
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');
}

const cookie = await login();
const list = await (
  await fetch(`${API}/api/matches/referee/list`, { headers: { cookie } })
).json();
const targets = list.filter((m) => m.refereeVerified);

if (targets.length === 0) {
  console.log(
    "Tasdiqlangan o'yin yo'q — avval hakam panelida kod kiriting (/referee).",
  );
  process.exit(0);
}

const point = async (id, player) => {
  const t0 = Date.now();
  const res = await fetch(`${API}/api/matches/${id}/point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie, Origin: ORIGIN },
    body: JSON.stringify({ player }),
  });
  return { ms: Date.now() - t0, ok: res.ok };
};

// 1) Ketma-ket
const seq = [];
for (let i = 0; i < 10; i++) seq.push((await point(targets[0].id, (i % 2) + 1)).ms);
seq.sort((a, b) => a - b);
console.log(`Ketma-ket (1 stol):   p50 ${pct(seq, 0.5)} ms · max ${seq.at(-1)} ms`);

// 2) Turli stollar bir vaqtda
const par = [];
for (let round = 0; round < 5; round++) {
  const res = await Promise.all(targets.map((m, i) => point(m.id, (i % 2) + 1)));
  par.push(...res.filter((r) => r.ok).map((r) => r.ms));
}
par.sort((a, b) => a - b);
console.log(
  `Parallel (${targets.length} stol × 5):  p50 ${pct(par, 0.5)} ms · p95 ${pct(par, 0.95)} ms · max ${par.at(-1)} ms`,
);

// 3) Bitta o'yinga bir vaqtda PARALLEL ta so'rov — yo'qolgan yangilanish bo'lmasin
const target = targets[0];
const before = await (await fetch(`${API}/api/matches/${target.id}`)).json();
const burst = await Promise.all(
  Array.from({ length: PARALLEL }, (_, i) => point(target.id, (i % 2) + 1)),
);
const after = await (await fetch(`${API}/api/matches/${target.id}`)).json();
const accepted = burst.filter((r) => r.ok).length;
const seqDelta = after.seq - before.seq;

if (accepted === 0) {
  // Odatda o'yin allaqachon yakunlangan (ochko qabul qilinmaydi) —
  // bunday holatda test hech narsani isbotlamaydi, buni yashirmaymiz.
  console.log(
    `Bitta o'yinga ${PARALLEL} parallel: 0 qabul qilindi (o'yin holati: ${after.status}) — ` +
      'sinov o‘tkazilmadi, yangi jonli o‘yin kerak',
  );
} else {
  console.log(
    `Bitta o'yinga ${PARALLEL} parallel: ${accepted} qabul qilindi, seq +${seqDelta} ` +
      (seqDelta === accepted ? '✓ (yo‘qolgan yangilanish yo‘q)' : '✗ HISOB BUZILDI'),
  );
}

// 4) Ommaviy endpointlar
const PUBLIC = [
  '/api/matches/live',
  '/api/rankings?gender=MALE',
  '/api/tournaments',
  '/api/players',
  '/api/search?q=chempionat&locale=uz',
];
for (const url of PUBLIC) {
  const times = [];
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now();
    await fetch(API + url);
    times.push(Date.now() - t0);
  }
  times.sort((a, b) => a - b);
  console.log(
    `${url.padEnd(42)} p50 ${String(pct(times, 0.5)).padStart(4)} ms · max ${String(times.at(-1)).padStart(4)} ms`,
  );
}

// Xato kod: faqat haqiqiy buzilishda (0 qabul qilingan holat — sinovsiz)
process.exit(accepted > 0 && seqDelta !== accepted ? 1 : 0);
