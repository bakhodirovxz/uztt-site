// WTT reference yoki lokal sayt skrinshotlarini oladi.
// Ishlatish: node capture.mjs wtt | node capture.mjs local [baseUrl]
// Chiqish: reference/<name>/<width>.png yoki current/<name>/<width>.png
// + measurements.json (shrift/o'lcham metrikalari — dizaynni RAQAMLARGA qarab
// qayta quramiz, asset ko'chirmaymiz).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'pages.json'), 'utf8'));

const mode = process.argv[2];
if (!['wtt', 'local'].includes(mode)) {
  console.error('Ishlatish: node capture.mjs wtt|local [baseUrl]');
  process.exit(1);
}
const localBase = process.argv[3] ?? 'http://localhost:3000';
const outRoot = join(__dirname, mode === 'wtt' ? 'reference' : 'current');

const browser = await chromium.launch();
const results = {};

for (const page of config.pages) {
  const url = mode === 'wtt' ? page.wttUrl : localBase + page.localPath;
  console.log(`[${page.name}] ${url}`);
  const outDir = join(outRoot, page.name);
  mkdirSync(outDir, { recursive: true });

  for (const width of config.widths) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      locale: 'en-US',
    });
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      // SPA'lar uchun qo'shimcha kutish + cookie banner yopish urinishi
      await p.waitForTimeout(mode === 'wtt' ? 5000 : 800);
      if (mode === 'wtt') {
        for (const sel of [
          'button:has-text("Accept")',
          'button:has-text("ACCEPT")',
          '[id*="cookie"] button',
          '.cc-allow',
        ]) {
          const btn = p.locator(sel).first();
          if (await btn.isVisible().catch(() => false)) {
            await btn.click().catch(() => {});
            await p.waitForTimeout(500);
            break;
          }
        }
      }
      await p.screenshot({
        path: join(outDir, `${width}.png`),
        fullPage: true,
      });

      // Metrikalar faqat desktop kenglikda
      if (width === 1440) {
        results[page.name] = await p.evaluate(() => {
          const m = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight,
              fontFamily: cs.fontFamily.split(',')[0],
              height: Math.round(r.height),
              width: Math.round(r.width),
              color: cs.color,
              background: cs.backgroundColor,
            };
          };
          return {
            header: m('header') ?? m('nav') ?? m('[class*="header"]'),
            h1: m('h1'),
            h2: m('h2'),
            body: m('body'),
            firstCard: m('[class*="card"]'),
            firstButton: m('button, a[class*="btn"]'),
          };
        });
      }
    } catch (err) {
      console.error(`  XATO (${width}px): ${err.message}`);
    } finally {
      await ctx.close();
    }
  }
}

writeFileSync(
  join(outRoot, 'measurements.json'),
  JSON.stringify(results, null, 2),
);
await browser.close();
console.log(`Tayyor: ${outRoot}`);
