// Bitta WTT sahifasidagi ANIQ komponentlarni o'lchaydi: sahifa sarlavha
// paneli, tab qatorlari, jadval qatori, filtr elementlari, yon panel kartalari.
//
// extract-design.mjs umumiy statistika beradi; bu esa "shu tugma qanday
// ko'rinadi" degan savolga raqam bilan javob beradi.
//
// Ishlatish: node extract-components.mjs <url> [--out fayl.json]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const url = process.argv[2];
if (!url) {
  console.error('Ishlatish: node extract-components.mjs <url> [--out fayl.json]');
  process.exit(1);
}
const outArg = process.argv.find((a) => a.startsWith('--out='));

const EXTRACT = () => {
  const spec = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      text: (el.textContent ?? '').trim().slice(0, 40),
      cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 60),
      w: Math.round(r.width),
      h: Math.round(r.height),
      font: `${cs.fontSize}/${cs.fontWeight} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`,
      tracking: cs.letterSpacing,
      transform: cs.textTransform,
      color: cs.color,
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 90) : null,
      radius: cs.borderRadius,
      padding: cs.padding,
      border: cs.borderWidth === '0px' ? null : `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`,
      borderBottom: cs.borderBottomWidth !== '0px' ? `${cs.borderBottomWidth} ${cs.borderBottomColor}` : null,
    };
  };

  const many = (sel, n = 4) =>
    Array.from(document.querySelectorAll(sel)).slice(0, n).map(spec);

  // Sahifa sarlavhasi turgan qora panel
  const titleBar = Array.from(document.querySelectorAll('div,section,header')).find((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      r.width > 1000 &&
      r.height > 30 &&
      r.height < 90 &&
      r.top < 300 &&
      /rgb\(0, 0, 0\)|rgb\(1[0-9], 1[0-9], 1[0-9]\)/.test(cs.backgroundColor) &&
      (el.textContent ?? '').trim().length > 5 &&
      (el.textContent ?? '').trim().length < 80
    );
  });

  // Jadval: header va birinchi uch qator
  const table = document.querySelector('table');
  const rows = table ? Array.from(table.querySelectorAll('tbody tr')).slice(0, 3) : [];

  return {
    titleBar: spec(titleBar),
    // Tab qatorlari — matni qisqa, pastki chegarasi bor havolalar
    tabs: many('[role="tab"], .nav-tabs a, .nav-link, ul li a', 12),
    buttons: many('button', 6),
    selects: many('select, .dropdown-toggle, [class*="filter"]', 6),
    tableHead: table ? many('table thead th', 8) : [],
    tableRows: rows.map((tr) => ({
      row: spec(tr),
      cells: Array.from(tr.querySelectorAll('td')).slice(0, 6).map(spec),
      imgs: Array.from(tr.querySelectorAll('img')).slice(0, 2).map((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius };
      }),
    })),
    // O'ng yon paneldagi kartalar (gradient sarlavhali)
    gradientBoxes: Array.from(document.querySelectorAll('div'))
      .filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.backgroundImage.includes('gradient') && r.width > 150 && r.height > 25;
      })
      .slice(0, 6)
      .map(spec),
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  locale: 'en-US',
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(6000);
for (const sel of ['button:has-text("Accept")', '[id*="cookie"] button', '.cc-allow']) {
  const b = page.locator(sel).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    await page.waitForTimeout(800);
    break;
  }
}
const data = await page.evaluate(EXTRACT);
await browser.close();

const json = JSON.stringify(data, null, 2);
if (outArg) {
  writeFileSync(outArg.slice('--out='.length), json);
  console.log('yozildi:', outArg.slice('--out='.length));
} else {
  console.log(json);
}
