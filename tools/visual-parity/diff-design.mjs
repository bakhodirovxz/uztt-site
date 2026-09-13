// reference/design-system.json va current/design-system.json ni RAQAMLARDA
// solishtiradi. "O'xshaydimi?" degan savolni o'lchovga aylantiradi.
//
// Ishlatish: node diff-design.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(
  readFileSync(join(__dirname, 'reference', 'design-system.json'), 'utf8'),
);
const cur = JSON.parse(
  readFileSync(join(__dirname, 'current', 'design-system.json'), 'utf8'),
);

/** Barcha sahifalar bo'yicha bitta o'lchovni yig'adi */
function merge(data, path) {
  const acc = {};
  for (const v of Object.values(data)) {
    if (!v || v.error) continue;
    const arr = path.split('.').reduce((o, k) => o?.[k], v) ?? [];
    for (const { value, weight } of arr) acc[value] = (acc[value] ?? 0) + weight;
  }
  return Object.entries(acc).sort((a, b) => b[1] - a[1]);
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);

function table(title, path, n = 10) {
  const a = merge(ref, path).slice(0, n);
  const b = merge(cur, path).slice(0, n);
  console.log(`\n${'='.repeat(88)}\n${title}\n${'='.repeat(88)}`);
  console.log(pad('  WTT (nishon)', 44) + '| BIZ (hozir)');
  console.log('-'.repeat(88));
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const l = a[i] ? `${String(a[i][1]).padStart(6)}  ${a[i][0]}` : '';
    const r = b[i] ? `${String(b[i][1]).padStart(6)}  ${b[i][0]}` : '';
    console.log(pad(l, 44) + '| ' + r);
  }
}

function landmark(name) {
  console.log(`\n${'='.repeat(88)}\nLANDMARK: ${name}\n${'='.repeat(88)}`);
  const a = ref.home?.landmarks?.[name];
  const b = cur.home?.landmarks?.[name];
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    if (k === 'selector') continue;
    const av = a?.[k] ?? '—';
    const bv = b?.[k] ?? '—';
    const flag = String(av) === String(bv) ? '  ' : '≠ ';
    console.log(`${flag}${pad(k, 16)} WTT: ${pad(av, 32)} BIZ: ${bv}`);
  }
}

table('FON RANGLARI (bo\'yalgan maydon bo\'yicha vaznlangan)', 'color.backgroundsByArea', 12);
table('MATN RANGLARI', 'typography.textColors', 8);
table('SHRIFT OILALARI', 'typography.families', 5);
table('SHRIFT OG\'IRLIKLARI', 'typography.weights', 8);
table('SHRIFT O\'LCHAMLARI', 'typography.sizes', 12);
table('HARF ORALIG\'I', 'typography.letterSpacings', 5);
table('BURCHAK RADIUSI', 'shape.radii', 8);
table('SOYALAR', 'shape.shadows', 5);
table('KONTEYNER KENGLIGI', 'shape.contentWidths', 6);
table('GRADIENTLAR', 'color.gradients', 5);

landmark('header');
landmark('body');
landmark('button');
landmark('link');

console.log(`\n${'='.repeat(88)}\nSAHIFA ZICHLIGI (DOM elementlari, 1440px)\n${'='.repeat(88)}`);
for (const name of Object.keys(ref)) {
  if (!cur[name]) continue;
  const a = ref[name].elementsAnalysed ?? 0;
  const b = cur[name].elementsAnalysed ?? 0;
  const ah = ref[name].documentHeight ?? 0;
  const bh = cur[name].documentHeight ?? 0;
  console.log(
    `${pad(name, 18)} WTT: ${String(a).padStart(5)} el / ${String(ah).padStart(6)}px   ` +
      `BIZ: ${String(b).padStart(5)} el / ${String(bh).padStart(6)}px`,
  );
}
