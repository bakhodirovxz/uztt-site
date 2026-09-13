// Efir sahifalari (/screen, /overlay) token o'zgarishidan keyin O'ZGARMASLIGI
// shart: bular proyektor va OBS grafikasi, jonli musobaqa paytida ularning
// rangini bilintirmay o'zgartirish — rejadagi eng yomon yakun.
//
// Ishlatish:
//   node broadcast-check.mjs baseline <baseUrl>   -> broadcast/baseline/*.png + colors.json
//   node broadcast-check.mjs verify   <baseUrl>   -> broadcast/after/*.png + farq hisoboti
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:3000';
if (!['baseline', 'verify'].includes(mode)) {
  console.error('Ishlatish: node broadcast-check.mjs baseline|verify <baseUrl>');
  process.exit(1);
}

const PAGES = [
  { name: 'screen', path: '/screen' },
  { name: 'screen-table1', path: '/screen/1' },
  { name: 'overlay-table1', path: '/overlay/table/1' },
];

const outDir = join(__dirname, 'broadcast', mode === 'baseline' ? 'baseline' : 'after');
mkdirSync(outDir, { recursive: true });

/** Ekrandagi barcha ko'rinadigan rangni bo'yalgan maydon bo'yicha yig'adi */
const COLORS = () => {
  const bg = {};
  const fg = {};
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const area = Math.round((r.width * r.height) / 100);
    const b = cs.backgroundColor;
    if (b && b !== 'rgba(0, 0, 0, 0)') bg[b] = (bg[b] ?? 0) + area;
    const hasText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.textContent.trim(),
    );
    if (hasText) fg[cs.color] = (fg[cs.color] ?? 0) + 1;
  }
  const top = (m) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  return { bg: top(bg), fg: top(fg) };
};

const browser = await chromium.launch();
const out = {};

for (const p of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  try {
    await page.goto(base + p.path, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(outDir, `${p.name}.png`), fullPage: false });
    out[p.name] = await page.evaluate(COLORS);
    console.log(`[${p.name}] ok`);
  } catch (e) {
    console.log(`[${p.name}] XATO: ${e.message}`);
    out[p.name] = { error: e.message };
  } finally {
    await ctx.close();
  }
}
await browser.close();
writeFileSync(join(outDir, 'colors.json'), JSON.stringify(out, null, 2));

if (mode === 'verify') {
  const basePath = join(__dirname, 'broadcast', 'baseline', 'colors.json');
  if (!existsSync(basePath)) {
    console.error('\nbaseline/colors.json yo\'q — avval `baseline` rejimini yuguriting.');
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(basePath, 'utf8'));
  let diffs = 0;
  console.log('\n===== EFIR RANGLARI: OLDIN -> KEYIN =====');
  for (const [name, after] of Object.entries(out)) {
    const b = before[name];
    if (!b || b.error || after.error) {
      console.log(`\n[${name}] solishtirib bo'lmadi`);
      continue;
    }
    const fmt = (arr) => arr.map(([c, w]) => `${c}(${w})`).join('  ');
    const sameBg = fmt(b.bg) === fmt(after.bg);
    const sameFg = fmt(b.fg) === fmt(after.fg);
    console.log(`\n[${name}] fon: ${sameBg ? 'BIR XIL' : 'O\'ZGARDI'}   matn: ${sameFg ? 'BIR XIL' : 'O\'ZGARDI'}`);
    if (!sameBg) {
      console.log('  oldin fon:', fmt(b.bg));
      console.log('  keyin fon:', fmt(after.bg));
      diffs++;
    }
    if (!sameFg) {
      console.log('  oldin matn:', fmt(b.fg));
      console.log('  keyin matn:', fmt(after.fg));
      diffs++;
    }
  }
  console.log(
    `\n${diffs === 0 ? 'TAYYOR: efir grafikasi o\'zgarmadi.' : `DIQQAT: ${diffs} ta farq topildi — tuzatilmaguncha deploy qilinmasin.`}`,
  );
  process.exit(diffs === 0 ? 0 : 1);
}
console.log(`\nTayyor: ${outDir}`);
