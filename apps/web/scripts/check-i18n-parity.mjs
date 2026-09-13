// Uchala til faylida kalitlar to'plami AYNAN bir xil bo'lishini tekshiradi.
//
// Nega kerak: uz/ru/en fayllari hozir bir xil kalitlar bilan turibdi (drift 0).
// Bu kamyob va qimmatli holat, lekin o'nlab sahifa tahriri uni tasodifan
// buzadi — kimdir bitta tilga kalit qo'shib, qolgan ikkitasini unutadi va
// sayt boshqa tilda kalit nomini ko'rsatib qo'yadi. Bu tekshiruvsiz drift
// xavf emas, KAFOLAT.
//
// Ishlatish: node scripts/check-i18n-parity.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES = join(__dirname, '..', 'src', 'messages');
const LOCALES = ['uz', 'ru', 'en'];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const sets = {};
for (const l of LOCALES) {
  sets[l] = new Set(flatten(JSON.parse(readFileSync(join(MESSAGES, `${l}.json`), 'utf8'))));
}

const all = new Set(LOCALES.flatMap((l) => [...sets[l]]));
const problems = [];
for (const key of [...all].sort()) {
  const missing = LOCALES.filter((l) => !sets[l].has(key));
  if (missing.length) problems.push(`  ${key}  —  yetishmaydi: ${missing.join(', ')}`);
}

// Bo'sh qiymatlar ham drift — kalit bor, tarjima yo'q
const empties = [];
for (const l of LOCALES) {
  const data = JSON.parse(readFileSync(join(MESSAGES, `${l}.json`), 'utf8'));
  const walk = (o, p = '') => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object') walk(v, `${p}${k}.`);
      else if (typeof v === 'string' && v.trim() === '') empties.push(`  ${l}: ${p}${k}`);
    }
  };
  walk(data);
}

console.log(`i18n: ${all.size} kalit × ${LOCALES.length} til`);
if (problems.length) {
  console.error(`\nDRIFT (${problems.length}):`);
  console.error(problems.join('\n'));
}
if (empties.length) {
  console.error(`\nBO'SH QIYMAT (${empties.length}):`);
  console.error(empties.join('\n'));
}
if (problems.length || empties.length) process.exit(1);
console.log('Drift yo\'q — uchala til bir xil.');
