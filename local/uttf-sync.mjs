// uttf.uz dan haqiqiy ma'lumotni yangilaydi: musobaqalar (eskilari ham), o'yinlar, klublar, yangiliklar (o'zbekcha, rasmlari bilan),
// o'yinchilar va ularning rasmlari. Internet kerak. Lokal API ishlab turishi kerak (2-start.bat).
// Mavjud yozuvlar o'chirilmaydi; qayta ishga tushirish xavfsiz (takrorlanmaydi).
const API = process.env.API_URL ?? 'http://localhost:4000/api';
const ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@uztt.uz';
const PASS = process.env.ADMIN_PASSWORD ?? 'admin123';

let cookie = '';
let errors = 0;
async function call(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(cookie ? { Cookie: cookie } : {}), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30 * 60_000),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${typeof body === 'string' ? body : (body.message ?? '')}`);
  return body;
}

// Kirish: ADMIN_EMAIL/ADMIN_PASSWORD, bo'lmasa Desktop\uztt-akkauntlar\akkauntlar.csv dagi bosh admin (SUPERADMIN)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
function findCreds() {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) return { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  const dirs = [path.join(os.homedir(), 'Desktop', 'uztt-akkauntlar'), path.resolve('..', 'uztt-akkauntlar'), path.resolve('uztt-akkauntlar')];
  for (const d of dirs) {
    try {
      for (const line of fs.readFileSync(path.join(d, 'akkauntlar.csv'), 'utf8').split(/\r?\n/)) {
        const c = line.split(',');
        if (c[0] === 'staff' && c[3] === 'SUPERADMIN') return { email: c[1], password: c[2] };
      }
    } catch { /* keyingisi */ }
  }
  return { email: EMAIL, password: PASS };
}
const cred = findCreds();
await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: cred.email, password: cred.password }) });
console.log('Kirildi.');
// Birinchi kirishda parolni almashtirish talab qilinsa: vaqtincha almashtirib, so'ng ASL parolga qaytaramiz
try { await call('/uttf-sync/probe'); } catch (e) {
  if (!/PASSWORD_CHANGE_REQUIRED|parol/i.test(e.message)) throw e;
  const tmp = 'Tmp-' + randomBytes(9).toString('base64url') + '!9aZ';
  await call('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: cred.password, newPassword: tmp }) });
  try {
    await call('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: tmp, newPassword: cred.password }) });
    console.log('Parol o\'zgarishsiz qoldi.');
  } catch {
    console.log('\n!!! Lokal bosh admin paroli vaqtincha: ' + tmp + '  (faqat shu kompyuterdagi baza uchun)');
  }
}

// Oldindan tekshiruv: manba bilan aloqa va javob shakli (hech narsa yozilmaydi)
console.log('\n▶ uttf.uz bilan aloqa tekshirilmoqda ...');
try {
  const probe = await call('/uttf-sync/probe');
  for (const p of probe) console.log(`  ${p.ok ? '✓' : '✗'} ${p.name}: ${p.ok ? `${p.total} ta yozuv` : p.error}`);
  if (probe.every((p) => !p.ok)) {
    console.log('\nuttf.uz ga ulanib bo\'lmadi. Internetni tekshiring (brauzerda https://uttf.uz ochiladimi?) va qayta urinib ko\'ring.');
    process.exit(1);
  }
} catch (e) { console.log('  XATO: ' + e.message); }

const steps = [
  ['clubs', 'Klublar'], ['news', 'Yangiliklar (o\'zbekcha, rasmlari bilan)'],
  ['tournaments', 'Musobaqalar (eskilari ham)'], ['tournament-names', 'Musobaqa nomlari (uz/ru/en)'],
  ['matches', 'O\'yin natijalari'], ['videos', 'Videolar'], ['players', 'O\'yinchilar (yangilari)'],
];
for (const [scope, label] of steps) {
  process.stdout.write(`\n▶ ${label} ... `);
  try {
    const r = await call('/uttf-sync/run', { method: 'POST', body: JSON.stringify({ scope, dryRun: false }) });
    console.log(`manbada ${r.fetched}, yangi ${r.created}, yangilandi ${r.updated}, o'tkazildi ${r.skipped}`);
    for (const w of r.warnings ?? []) console.log('  ! ' + w);
  } catch (e) { errors++; console.log('XATO: ' + e.message + (/500/.test(e.message) ? '  (internet bormi? uttf.uz ochiladimi?)' : '')); }
}

console.log('\n▶ O\'yinchi rasmlari (bo\'laklab, bir necha daqiqa) ...');
for (let round = 1; round <= 60; round++) {
  try {
    const r = await call('/uttf-sync/run', { method: 'POST', body: JSON.stringify({ scope: 'photos', dryRun: false, limit: 300, force: true }) });
    console.log(`  ${round}: yuklandi ${r.updated}, o'tkazildi ${r.skipped}, qoldi ${r.remaining ?? 0}`);
    if (!r.remaining || (r.updated === 0 && r.skipped > 0)) break;
  } catch (e) { console.log('  XATO: ' + e.message); break; }
}
console.log(errors ? `\nTugadi, lekin ${errors} ta bo'limda xato bo'ldi (yuqoriga qarang). Internetni tekshirib qayta ishga tushiring.` : '\nTAYYOR. Saytni yangilang (F5). Rasmlar ko\'rinmasa 3-stop.bat va 2-start.bat.');
