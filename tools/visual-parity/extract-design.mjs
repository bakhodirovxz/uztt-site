// Sayt dizayn tizimini RAQAMLARDA chiqarib oladi: shrift zinapoyasi, bo'yalgan
// maydon bo'yicha rang palitrasi, radius/soya/gradient lug'ati, konteyner
// kengligi, karta va tugma spetsifikatsiyasi.
//
// Ishlatish:
//   node extract-design.mjs wtt                    -> reference/design-system.json
//   node extract-design.mjs local [baseUrl]        -> current/design-system.json
//
// Maqsad — WTT'ni ko'z bilan taqlid qilish emas, o'lchab qayta qurish.
// Skrinshot va asset ko'chirilmaydi (pages.json dagi huquqiy eslatmaga qarang).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'pages.json'), 'utf8'));

const mode = process.argv[2];
if (!['wtt', 'local'].includes(mode)) {
  console.error('Ishlatish: node extract-design.mjs wtt|local [baseUrl]');
  process.exit(1);
}
const localBase = process.argv[3] ?? 'http://localhost:3000';
const outRoot = join(__dirname, mode === 'wtt' ? 'reference' : 'current');
mkdirSync(outRoot, { recursive: true });

/** Sahifa ichida bajariladigan tahlil — DOM'ni to'liq kezib metrika yig'adi */
const EXTRACTOR = () => {
  const bump = (map, key, weight = 1) => {
    if (!key) return;
    map[key] = (map[key] ?? 0) + weight;
  };
  const sortTop = (map, n) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => ({ value: k, weight: Math.round(v) }));

  const fonts = {};
  const weights = {};
  const sizes = {};
  const textColors = {};
  const bgColors = {};
  const radii = {};
  const shadows = {};
  const gradients = {};
  const letterSpacings = {};
  const lineHeights = {};
  const transforms = {};

  const all = document.querySelectorAll('*');
  let counted = 0;

  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    counted++;

    const area = r.width * r.height;
    const hasText =
      el.childNodes.length > 0 &&
      Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      );

    // Fon ranglari — bo'yalgan MAYDON bo'yicha vaznlanadi
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      bump(bgColors, bg, area / 1000);
    }
    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg.includes('gradient')) {
      bump(gradients, bgImg.slice(0, 200), 1);
    }

    // Tipografiya — faqat haqiqiy matn tashuvchi elementlar
    if (hasText) {
      bump(fonts, cs.fontFamily.split(',')[0].replace(/["']/g, ''));
      bump(weights, cs.fontWeight);
      bump(sizes, cs.fontSize);
      bump(textColors, cs.color);
      bump(letterSpacings, cs.letterSpacing);
      bump(lineHeights, cs.lineHeight);
      if (cs.textTransform !== 'none') bump(transforms, cs.textTransform);
    }

    if (cs.borderRadius && cs.borderRadius !== '0px') {
      bump(radii, cs.borderRadius);
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      // Tailwind v4 box-shadow'ni beshta qatlamdan yig'adi (inset/ring/...)
      // va ishlatilmaganlarini `rgba(0,0,0,0) 0px 0px 0px 0px` qilib qoldiradi.
      // Ularni tashlamasak, haqiqiy soya satr oxirida qolib ketadi va
      // "soyalar yo'q" degan noto'g'ri xulosa chiqadi.
      const real = cs.boxShadow
        .split(/,(?![^(]*\))/)
        .map((s) => s.trim())
        .filter((s) => !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(s))
        .join(', ');
      if (real) bump(shadows, real.slice(0, 120));
    }
  }

  // Konteyner kengligi — eng ko'p takrorlanadigan "content" kengligi
  const contentWidths = {};
  for (const el of document.querySelectorAll('div, section, main, header, footer')) {
    const r = el.getBoundingClientRect();
    if (r.width > 600 && r.width < window.innerWidth) {
      bump(contentWidths, Math.round(r.width) + 'px');
    }
  }

  const one = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      selector: sel,
      w: Math.round(r.width),
      h: Math.round(r.height),
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      color: cs.color,
      background: cs.backgroundColor,
      backgroundImage:
        cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 120) : null,
      borderRadius: cs.borderRadius,
      padding: cs.padding,
      textTransform: cs.textTransform,
      letterSpacing: cs.letterSpacing,
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 120) : null,
    };
  };

  // :root dagi CSS o'zgaruvchilari (dizayn tizimining rasmiy manbasi)
  const cssVars = {};
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin
    }
    for (const rule of Array.from(rules ?? [])) {
      if (!rule.style || !rule.selectorText) continue;
      if (!/^:root|^html|^body/.test(rule.selectorText)) continue;
      for (const prop of Array.from(rule.style)) {
        if (prop.startsWith('--')) {
          cssVars[prop] = rule.style.getPropertyValue(prop).trim().slice(0, 120);
        }
      }
    }
  }

  return {
    elementsAnalysed: counted,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    documentHeight: document.documentElement.scrollHeight,
    typography: {
      families: sortTop(fonts, 6),
      weights: sortTop(weights, 10),
      sizes: sortTop(sizes, 14),
      lineHeights: sortTop(lineHeights, 8),
      letterSpacings: sortTop(letterSpacings, 6),
      textTransforms: sortTop(transforms, 4),
      textColors: sortTop(textColors, 10),
    },
    color: {
      backgroundsByArea: sortTop(bgColors, 14),
      gradients: sortTop(gradients, 10),
    },
    shape: {
      radii: sortTop(radii, 10),
      shadows: sortTop(shadows, 8),
      contentWidths: sortTop(contentWidths, 6),
    },
    landmarks: {
      header: one('header') ?? one('nav') ?? one('[class*="header"]'),
      h1: one('h1'),
      h2: one('h2'),
      body: one('body'),
      button: one('button'),
      link: one('a'),
      card: one('[class*="card"]'),
      table: one('table'),
      footer: one('footer'),
    },
    cssVars,
  };
};

const browser = await chromium.launch();
const out = {};

for (const page of config.pages) {
  const url = mode === 'wtt' ? page.wttUrl : localBase + page.localPath;
  process.stdout.write(`[${page.name}] ${url} ... `);
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await p.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await p.waitForTimeout(mode === 'wtt' ? 6000 : 1200);

    if (mode === 'wtt') {
      for (const sel of [
        'button:has-text("Accept")',
        'button:has-text("ACCEPT")',
        'button:has-text("Agree")',
        '[id*="cookie"] button',
        '.cc-allow',
      ]) {
        const btn = p.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click().catch(() => {});
          await p.waitForTimeout(800);
          break;
        }
      }
    }

    out[page.name] = await p.evaluate(EXTRACTOR);
    console.log(`ok (${out[page.name].elementsAnalysed} element)`);
  } catch (err) {
    console.log(`XATO: ${err.message}`);
    out[page.name] = { error: err.message };
  } finally {
    await ctx.close();
  }
}

writeFileSync(
  join(outRoot, 'design-system.json'),
  JSON.stringify(out, null, 2),
);
await browser.close();
console.log(`\nTayyor: ${join(outRoot, 'design-system.json')}`);
