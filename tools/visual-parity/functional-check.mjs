// To'liq funksional tekshiruv: har bir ommaviy marshrut, uchala til,
// navigatsiya, qidiruv, reyting tablari, sahifalash, login va panel.
//
// Har sahifada quyidagilar ham yig'iladi:
//   - konsol xatolari (JS sinishi)
//   - muvaffaqiyatsiz tarmoq so'rovlari (404 rasm, o'lik API)
//   - gorizontal scroll (layout toshib ketishi)
//   - bo'sh sahifa (kontent umuman yo'q)
//
// Ishlatish:
//   node functional-check.mjs <baseUrl> [--login email:parol]
import { chromium } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:3200').replace(/\/$/, '');
const loginArg = process.argv.find((a) => a.startsWith('--login='));
const creds = loginArg ? loginArg.slice('--login='.length).split(':') : null;

const PUBLIC_ROUTES = [
  ['bosh sahifa', '/'],
  ['yangiliklar', '/yangiliklar'],
  ['yangilik (detal)', '/yangiliklar/pro-tour-1001'],
  ["o'yinchilar", '/oyinchilar'],
  ["o'yinchilar 2-sahifa", '/oyinchilar?page=2'],
  ["o'yinchi (detal)", '/oyinchilar/iskandarov-shohrux-shuxratovich-itrcg'],
  ['taqqoslash', '/oyinchilar/taqqoslash'],
  ['reyting', '/reyting'],
  ['reyting — juftlik', '/reyting?type=doubles'],
  ['reyting — aralash', '/reyting?type=mixed'],
  ['reyting — jamoaviy', '/reyting?type=team'],
  ['musobaqalar', '/musobaqalar'],
  ['musobaqa (detal)', '/musobaqalar/uzbekistan-cup-among-the-kata-1156'],
  ['jonli', '/live'],
  ['galereya', '/galereya'],
  ['videolar', '/videos'],
  ['federatsiya', '/federatsiya'],
  ['aloqa', '/aloqa'],
  ['qidiruv', '/search'],
  ['kirish', '/login'],
  ["ro'yxatdan o'tish", '/signup'],
  ['404 sahifasi', '/bunday-sahifa-yoq-12345'],
  ['— RUSCHA —', '/ru'],
  ['ru yangiliklar', '/ru/novosti'],
  ['ru reyting', '/ru/reyting'],
  ["ru o'yinchilar", '/ru/igroki'],
  ['— INGLIZCHA —', '/en'],
  ['en news', '/en/news'],
  ['en rankings', '/en/rankings'],
  ['en players', '/en/players'],
];

// Shovqin: brauzer kengaytmalari, tashqi reklama bloklovchilari va h.k.
const IGNORE_CONSOLE = [
  /favicon/i,
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  // Anonim tashrifchida /auth/me 401 qaytaradi — kutilgan
  /status of 401/i,
];

const results = [];
const browser = await chromium.launch();

async function visit(label, path, ctx) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORE_CONSOLE.some((re) => re.test(t))) return;
    consoleErrors.push(t.slice(0, 120));
  });
  page.on('requestfailed', (r) => {
    // Next.js sahifa o'tishlarini oldindan yuklaydi (?_rsc=...). Playwright
    // sahifadan chiqib ketganda bu so'rovlar net::ERR_ABORTED bilan uziladi —
    // bu XATO EMAS. nginx logida ular 200 bo'lib turadi (tekshirilgan).
    const failure = r.failure()?.errorText ?? '';
    if (r.url().includes('_rsc=') && /ABORTED/i.test(failure)) return;
    failedRequests.push(`${failure} ${r.method()} ${r.url().slice(0, 80)}`);
  });
  page.on('response', (r) => {
    // /auth/me anonim tashrifchida 401 qaytaradi — header shu bilan
    // "Kirish" yoki "Kabinet" ko'rsatishini hal qiladi. Kutilgan holat.
    if (r.status() === 401 && r.url().includes('/auth/me')) return;
    if (r.status() >= 400) {
      failedRequests.push(`${r.status()} ${r.url().slice(0, 85)}`);
    }
  });

  let status = 0;
  let err = null;
  const info = {};
  try {
    const resp = await page.goto(base + path, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    status = resp?.status() ?? 0;
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
    Object.assign(
      info,
      await page.evaluate(() => ({
        textLen: document.body.innerText.trim().length,
        h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? null,
        hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        scrollW: document.documentElement.scrollWidth,
        links: document.querySelectorAll('a[href]').length,
        imgs: document.querySelectorAll('img').length,
        brokenImgs: Array.from(document.querySelectorAll('img')).filter(
          (i) => i.complete && i.naturalWidth === 0,
        ).length,
      })),
    );
  } catch (e) {
    err = e.message.slice(0, 100);
  }
  await page.close();

  results.push({ label, path, status, err, consoleErrors, failedRequests, ...info });
  return info;
}

// ---------- 1. Ommaviy marshrutlar ----------
console.log('===== 1. OMMAVIY MARSHRUTLAR =====');
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const [label, path] of PUBLIC_ROUTES) {
  if (label.startsWith('—')) {
    console.log(`\n${label}`);
    continue;
  }
  const i = await visit(label, path, ctx);
  const r = results[results.length - 1];
  const flags = [];
  if (r.err) flags.push(`XATO: ${r.err}`);
  if (r.status >= 400 && !label.includes('404')) flags.push(`HTTP ${r.status}`);
  if (label.includes('404') && r.status !== 404) flags.push(`404 KUTILGAN, ${r.status} keldi`);
  const minText = label.includes('404') ? 10 : 100;
  if (i.textLen !== undefined && i.textLen < minText) flags.push(`BO'SH (${i.textLen} belgi)`);
  if (i.hOverflow) flags.push(`GORIZONTAL SCROLL (${i.scrollW}px)`);
  if (i.brokenImgs) flags.push(`${i.brokenImgs} sinq rasm`);
  if (r.consoleErrors.length) flags.push(`${r.consoleErrors.length} konsol xatosi`);
  if (r.failedRequests.length) flags.push(`${r.failedRequests.length} so'rov xatosi`);
  console.log(
    `  ${flags.length ? 'X' : 'ok'}  ${label.padEnd(26)} ${String(r.status).padStart(3)}  ` +
      `${String(i.textLen ?? 0).padStart(6)} belgi  ${flags.join(' | ')}`,
  );
}

// ---------- 2. Interaktiv tekshiruvlar ----------
console.log('\n===== 2. INTERAKTIV =====');
const inter = [];
const check = async (name, fn) => {
  const page = await ctx.newPage();
  try {
    const detail = await fn(page);
    console.log(`  ok  ${name.padEnd(34)} ${detail ?? ''}`);
    inter.push({ name, ok: true });
  } catch (e) {
    console.log(`  X   ${name.padEnd(34)} ${e.message.slice(0, 90)}`);
    inter.push({ name, ok: false, error: e.message });
  } finally {
    await page.close();
  }
};

await check('til almashtirgich (uz -> ru)', async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle', timeout: 40_000 });
  await p.getByRole('group').getByText('Ру', { exact: true }).click();
  await p.waitForURL(/\/ru/, { timeout: 15_000 });
  return p.url().replace(base, '');
});

await check('navigatsiya: reyting havolasi', async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle', timeout: 40_000 });
  await p.locator('header nav a').filter({ hasText: /REYTING/i }).first().click();
  await p.waitForURL(/reyting/, { timeout: 15_000 });
  return p.url().replace(base, '');
});

await check('reyting tab: Jamoaviy', async (p) => {
  await p.goto(base + '/reyting', { waitUntil: 'networkidle', timeout: 40_000 });
  await p.getByRole('link', { name: /Jamoaviy/i }).first().click();
  await p.waitForTimeout(2500);
  const rows = await p.locator('tbody tr').count();
  if (rows < 5) throw new Error(`jamoaviy tabda ${rows} qator (kutilgan: 100)`);
  return `${rows} qator`;
});

await check("o'yinchilar sahifalash (2-sahifa)", async (p) => {
  await p.goto(base + '/oyinchilar', { waitUntil: 'networkidle', timeout: 40_000 });
  const before = await p.locator('ol li').first().innerText();
  await p.locator('nav a').filter({ hasText: '›' }).first().click();
  await p.waitForTimeout(2500);
  const after = await p.locator('ol li').first().innerText();
  if (before === after) throw new Error('2-sahifa 1-sahifa bilan bir xil');
  return 'ro\'yxat o\'zgardi';
});

await check('qidiruv (typeahead)', async (p) => {
  await p.goto(base + '/', { waitUntil: 'networkidle', timeout: 40_000 });
  await p.locator('header button[aria-label], header button').last().click().catch(() => {});
  const input = p.locator('header input[type="search"], header input').first();
  await input.fill('Aziz', { timeout: 10_000 });
  await p.waitForTimeout(2000);
  const txt = await p.locator('header').innerText();
  if (!/aziz/i.test(txt)) throw new Error('typeahead natija bermadi');
  return 'natija keldi';
});

await check('mobil menyu (Escape yopadi)', async (p) => {
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(base + '/', { waitUntil: 'networkidle', timeout: 40_000 });
  await p.locator('button[aria-label="Menu"]').click();
  const menu = p.locator('#mobile-menu');
  if (!(await menu.isVisible())) throw new Error('menyu ochilmadi');
  const locked = await p.evaluate(() => document.body.style.overflow);
  if (locked !== 'hidden') throw new Error(`scroll qulflanmadi (${locked})`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  if (await menu.isVisible()) throw new Error('Escape menyuni yopmadi');
  return 'ochildi, qulfladi, Escape yopdi';
});

// ---------- 3. Autentifikatsiya ----------
if (creds) {
  console.log('\n===== 3. AUTENTIFIKATSIYA =====');
  await check('login -> panel', async (p) => {
    await p.goto(base + '/login', { waitUntil: 'networkidle', timeout: 40_000 });
    await p.locator('input[type="email"], input[name="email"]').first().fill(creds[0]);
    await p.locator('input[type="password"]').first().fill(creds.slice(1).join(':'));
    await p.locator('button[type="submit"]').first().click();
    await p.waitForURL(/panel|profile/, { timeout: 20_000 });
    return p.url().replace(base, '');
  });
} else {
  console.log("\n===== 3. AUTENTIFIKATSIYA ===== (--login berilmadi, o'tkazib yuborildi)");
}

await browser.close();

// ---------- Yakuniy hisobot ----------
console.log('\n===== YAKUN =====');
const bad = results.filter(
  (r) =>
    r.err ||
    (r.status >= 400 && !r.label.includes('404')) ||
    (r.textLen !== undefined && r.textLen < (r.label.includes('404') ? 10 : 100)) ||
    r.hOverflow ||
    r.brokenImgs ||
    r.consoleErrors.length ||
    r.failedRequests.length,
);
console.log(`Marshrutlar: ${results.length}, muammoli: ${bad.length}`);
for (const r of bad) {
  console.log(`\n[${r.label}] ${r.path} (HTTP ${r.status})`);
  if (r.err) console.log('  xato:', r.err);
  if (r.hOverflow) console.log('  gorizontal scroll:', r.scrollW, 'px');
  if (r.brokenImgs) console.log('  sinq rasm:', r.brokenImgs);
  for (const c of r.consoleErrors.slice(0, 3)) console.log('  konsol:', c);
  for (const f of [...new Set(r.failedRequests)].slice(0, 4)) console.log('  so\'rov:', f);
}
const interBad = inter.filter((i) => !i.ok);
console.log(`\nInteraktiv: ${inter.length}, muvaffaqiyatsiz: ${interBad.length}`);
process.exit(bad.length + interBad.length > 0 ? 1 : 0);
