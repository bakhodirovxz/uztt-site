#!/usr/bin/env node
/**
 * Sahifa o'lchovi: LCP elementi, LCP/FCP/CLS, va resurs hajmlari turlar bo'yicha.
 * Lighthouse "LCP element" ni ba'zan aniqlay olmaydi — bu yerda uni brauzerning
 * o'zidan (PerformanceObserver) olamiz.
 *
 *   node tools/audit/measure.mjs                      # bosh sahifa
 *   node tools/audit/measure.mjs /reyting /yangiliklar
 *   BASE_URL=http://localhost:3100 node tools/audit/measure.mjs
 */
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3100';
const paths = process.argv.slice(2);
const targets = paths.length > 0 ? paths : ['/'];

const browser = await chromium.launch();
// Mobil profil + sekin CPU: Lighthouse shartlariga yaqin
const context = await browser.newContext({ ...devices['Pixel 7'] });

for (const path of targets) {
  const page = await context.newPage();
  const bytes = {};
  page.on('response', async (res) => {
    const type = res.request().resourceType();
    const len = Number(res.headers()['content-length'] ?? 0);
    bytes[type] = (bytes[type] ?? 0) + len;
  });

  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });

  const metrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = { lcp: 0, lcpElement: '', cls: 0, fcp: 0, resources: 0 };
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1);
          out.lcp = Math.round(e.startTime);
          out.lcpElement = e.element
            ? `${e.element.tagName.toLowerCase()}${e.element.className ? '.' + String(e.element.className).split(' ').slice(0, 2).join('.') : ''} — "${(e.element.textContent ?? '').trim().slice(0, 60)}"`
            : e.url || '(noma’lum)';
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) out.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });

        const fcp = performance
          .getEntriesByType('paint')
          .find((p) => p.name === 'first-contentful-paint');
        out.fcp = Math.round(fcp?.startTime ?? 0);
        out.resources = performance.getEntriesByType('resource').length;

        setTimeout(() => {
          out.cls = Math.round(out.cls * 1000) / 1000;
          resolve(out);
        }, 1200);
      }),
  );

  const kb = (n) => `${Math.round((n ?? 0) / 1024)} KB`;
  console.log(`\n▸ ${path}`);
  console.log(`  FCP ${metrics.fcp} ms · LCP ${metrics.lcp} ms · CLS ${metrics.cls}`);
  console.log(`  LCP elementi: ${metrics.lcpElement}`);
  console.log(
    `  Resurslar: ${metrics.resources} ta · JS ${kb(bytes.script)} · shrift ${kb(bytes.font)} · CSS ${kb(bytes.stylesheet)} · rasm ${kb(bytes.image)}`,
  );
  await page.close();
}

await browser.close();
