// uttf.uz API kashfiyoti — endpointlarni TAXMIN QILMAYMIZ, TUTIB OLAMIZ.
//
// Nega kerak: uttf.uz Angie orqasida Next.js, backend esa Spring Boot.
// Ma'lumot klient tomonda yuklanadi, sitemap ishlamaydi, robots.txt yo'q.
// Qo'lda urinib ko'rilganda:
//   GET /api/table-tennis/clubs  -> 405, `Allow: DELETE`
//   GET /api/table-tennis/club   -> 403 (marshrut bor, avtorizatsiya kerak)
// `/index` va `/detail` nomlari + `405 Allow: DELETE` — bu Java'dagi
// `POST /…/index` + JSON filtr konvensiyasining belgisi.
//
// SPA bu ma'lumotni brauzerda yuklayotgani isbotlangan, ya'ni ishlaydigan
// (method, path, headers, body) to'rtliklari MAVJUD. Shuning uchun brauzerni
// haydab, har bir tarmoq so'rovini yozib olamiz.
//
// Ishlatish:
//   node discover.mjs [--out=uttf-endpoints.json] [--headed]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = outArg ? outArg.slice('--out='.length) : join(__dirname, 'uttf-endpoints.json');
const HEADED = process.argv.includes('--headed');

const BASE = 'https://uttf.uz';
// uttf.uz ning haqiqiy ommaviy sahifalari (probe bilan tasdiqlangan)
const PAGES = ['/', '/news', '/clubs', '/rating', '/players', '/about', '/competitions'];
const LOCALES = ['uz', 'ru', 'en'];

/** Qiziqtiradigan so'rovlar — uttf.uz o'z backendiga qilganlari */
const isApi = (url) => /\/api\/|\/table-tennis\//.test(url) && url.includes('uttf.uz');

const calls = new Map(); // kalit: METHOD path  ->  yozuv

function record(kind, req, res, body) {
  const u = new URL(req.url());
  const key = `${req.method()} ${u.pathname}`;
  const prev = calls.get(key) ?? {
    method: req.method(),
    path: u.pathname,
    seenOn: new Set(),
    queryKeys: new Set(),
    requestBodies: [],
    status: null,
    responseShape: null,
    sample: null,
    count: 0,
  };
  prev.count++;
  for (const k of u.searchParams.keys()) prev.queryKeys.add(k);
  if (kind === 'response' && res) {
    prev.status = res.status();
    if (body) {
      prev.responseShape = shapeOf(body);
      prev.sample = redact(body);
    }
  }
  const post = req.postData();
  if (post && prev.requestBodies.length < 3 && !prev.requestBodies.includes(post)) {
    prev.requestBodies.push(post.slice(0, 400));
  }
  calls.set(key, prev);
}

/** Javob tuzilishini (maydon nomlari) chiqaradi — qiymatlarsiz */
function shapeOf(v, depth = 0) {
  if (depth > 3) return '…';
  if (Array.isArray(v)) return v.length ? [shapeOf(v[0], depth + 1)] : [];
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 40)) o[k] = shapeOf(v[k], depth + 1);
    return o;
  }
  return typeof v;
}

/**
 * Namuna javob — SHAXSIY MA'LUMOT olib tashlanadi.
 * uttf.uz javoblarida pinfl (milliy ID), to'liq ism va tug'ilgan yil bor;
 * ular kashfiyot faylida saqlanmasligi kerak (fayl repoga commit qilinadi).
 */
const PII = /^(pinfl|fio|firstName|lastName|middleName|phone|passport|birth|address)/i;
function redact(v, depth = 0) {
  if (depth > 2) return '…';
  if (Array.isArray(v)) return v.slice(0, 1).map((x) => redact(x, depth + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).slice(0, 40)) {
      o[k] = PII.test(k) ? '<olib tashlandi>' : redact(v[k], depth + 1);
    }
    return o;
  }
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…';
  return v;
}

const browser = await chromium.launch({ headless: !HEADED });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/140.0.0.0 Safari/537.36',
});

const page = await ctx.newPage();
page.on('request', (r) => {
  if (isApi(r.url())) record('request', r);
});
page.on('response', async (r) => {
  if (!isApi(r.url())) return;
  let body = null;
  try {
    const ct = r.headers()['content-type'] ?? '';
    if (ct.includes('json')) body = await r.json();
  } catch {
    /* javob o'qilmadi — muhim emas */
  }
  record('response', r.request(), r, body);
});

const detailLinks = new Set();

for (const locale of LOCALES) {
  for (const path of PAGES) {
    const url = `${BASE}/${locale}${path === '/' ? '' : path}`;
    process.stdout.write(`[${locale}${path}] `);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
      await page.waitForTimeout(2500);
      // Ro'yxatlarda pastga aylantiramiz — lazy yuklanadigan so'rovlar ham chiqsin
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1500);
      // Detal sahifalariga havolalarni yig'amiz
      const hrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href'))
          .filter((h) => h && /\/(news|players|clubs|competitions)\/[^/]+$/.test(h))
          .slice(0, 40),
      );
      for (const h of hrefs) detailLinks.add(h.startsWith('http') ? h : BASE + h);
      console.log('ok');
    } catch (e) {
      console.log('XATO:', e.message.slice(0, 60));
    }
  }
}

// Har turdan bir nechta detal sahifa — detail endpointlari shu yerda chiqadi
const sampled = [...detailLinks].slice(0, 12);
console.log(`\nDetal sahifalar: ${sampled.length} ta namuna`);
for (const url of sampled) {
  process.stdout.write(`[detal] ${url.replace(BASE, '')} `);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('ok');
  } catch (e) {
    console.log('XATO:', e.message.slice(0, 50));
  }
}

await browser.close();

// ---- Chunk grep: siz bormagan sahifalarning endpointlari ----
// Aynan eng kerakli musobaqa natijalari endpointi shu yo'l bilan topiladi.
console.log('\nJS chunklarda endpoint qidirilmoqda...');
const html = await fetch(`${BASE}/en`).then((r) => r.text());
const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[a-zA-Z0-9._-]+\.js/g) ?? [])];
const fromChunks = new Set();
for (const c of chunks.slice(0, 40)) {
  try {
    const js = await fetch(BASE + c).then((r) => r.text());
    for (const m of js.matchAll(/["'`](\/(?:api\/)?table-tennis\/[a-zA-Z0-9/_$.{}-]+)["'`]/g)) {
      fromChunks.add(m[1]);
    }
  } catch {
    /* chunk olinmadi */
  }
}
console.log(`  ${chunks.length} chunk tekshirildi, ${fromChunks.size} ta yo'l topildi`);

const result = {
  generatedFrom: BASE,
  note:
    "Kashfiyot natijasi. Shaxsiy maydonlar (pinfl, ism, tug'ilgan sana) " +
    'namunalardan olib tashlangan — bu fayl ochiq repoga commit qilinadi.',
  capturedCalls: [...calls.values()]
    .map((c) => ({
      ...c,
      seenOn: undefined,
      queryKeys: [...c.queryKeys],
    }))
    .sort((a, b) => b.count - a.count),
  pathsFoundInChunks: [...fromChunks].sort(),
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nTutilgan chaqiruvlar: ${calls.size}`);
console.log(`Yozildi: ${OUT}`);
