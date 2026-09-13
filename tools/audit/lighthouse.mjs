#!/usr/bin/env node
/**
 * Lighthouse audit — mobil profil, budjet bilan.
 *
 * Talab: sayt ishlab turishi (Docker yoki `pnpm dev:web`) va Chrome/Chromium.
 * Chrome topilmasa CHROME_PATH orqali ko'rsating (Playwright chromium ham yaraydi).
 *
 * Ishga tushirish:
 *   node tools/audit/lighthouse.mjs
 *   BASE_URL=http://localhost:3100 node tools/audit/lighthouse.mjs
 *
 * Chiqish kodi: budjetdan past ball bo'lsa 1 (CI'da to'xtatadi).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3100';
const OUT_DIR = join(process.cwd(), 'tools', 'audit', 'reports');

/** Sahifa → minimal ballar (0..100). Rejadagi budjet: mobil perf ≥ 90 */
const TARGETS = [
  { name: 'home', path: '/', budget: { performance: 90, accessibility: 95, 'best-practices': 90, seo: 95 } },
  { name: 'news', path: '/yangiliklar', budget: { performance: 90, accessibility: 95, 'best-practices': 90, seo: 95 } },
  { name: 'rankings', path: '/reyting', budget: { performance: 90, accessibility: 95, 'best-practices': 90, seo: 95 } },
  { name: 'event', path: '/musobaqalar', budget: { performance: 85, accessibility: 95, 'best-practices': 90, seo: 95 } },
];

mkdirSync(OUT_DIR, { recursive: true });

let failed = false;

for (const target of TARGETS) {
  const url = `${BASE_URL}${target.path}`;
  const outFile = join(OUT_DIR, `${target.name}.json`);
  rmSync(outFile, { force: true });

  console.log(`\n▸ ${target.name}: ${url}`);
  // Windows'da .cmd ni shell'siz spawn qilib bo'lmaydi (Node 20+ buni bloklaydi)
  const isWin = process.platform === 'win32';
  const run = spawnSync(
    isWin ? 'npx.cmd' : 'npx',
    [
      '--yes',
      'lighthouse',
      url,
      '--quiet',
      // Mobil profil — Lighthouse'ning sukutdagi emulyatsiyasi (Moto G Power)
      '--form-factor=mobile',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless=new --no-sandbox',
      '--output=json',
      `--output-path=${outFile}`,
    ],
    { stdio: 'inherit', shell: isWin },
  );

  if (run.error) console.error(`  ${run.error.message}`);

  // Windows'da chrome-launcher o'zining temp papkasini o'chirolmay EPERM bilan
  // yiqiladi — lekin hisobot allaqachon yozilgan bo'ladi. Shuning uchun
  // chiqish kodiga emas, hisobot faylining mavjudligiga qaraymiz.
  if (!existsSync(outFile)) {
    console.error(
      `  Lighthouse hisobot yozmadi (${target.name}, chiqish kodi ${run.status}).`,
    );
    failed = true;
    continue;
  }

  const report = JSON.parse(readFileSync(outFile, 'utf8'));
  for (const [category, min] of Object.entries(target.budget)) {
    const score = Math.round((report.categories[category]?.score ?? 0) * 100);
    const ok = score >= min;
    console.log(`  ${ok ? '✓' : '✗'} ${category}: ${score} (kerak ≥ ${min})`);
    if (!ok) failed = true;
  }
}

console.log(
  failed
    ? '\nBudjet bajarilmadi — hisobotlar tools/audit/reports/ da'
    : '\nHamma sahifa budjetdan o‘tdi',
);
process.exit(failed ? 1 : 0);
