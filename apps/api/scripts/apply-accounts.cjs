#!/usr/bin/env node
/**
 * Berilgan parollar fayli (akkauntlar.csv) bo'yicha hisoblarni bazaga yaratadi.
 *   cd apps/api && node scripts/apply-accounts.cjs ../../akkauntlar.csv            # faqat hisobot (hech narsa yozmaydi)
 *   cd apps/api && node scripts/apply-accounts.cjs ../../akkauntlar.csv --apply    # yaratadi
 *   ... --apply --reset-staff
 *       mavjud boshqaruvchilardan FAQAT hali boshlang'ich parolda turganlari (mustChangePassword = true)
 *       parolini faylnikiga almashtiradi. O'z parolini qo'ygan hisob va SUPERADMIN'ga TEGILMAYDI.
 *   ... --apply --reset-email=a@example.com,b@example.com
 *       aynan shu (nomi bilan ko'rsatilgan) mavjud hisoblarni tiklaydi — o'z parolini qo'ygan yoki
 *       SUPERADMIN bo'lsa ham. Root'ni tiklashning YAGONA yo'li.
 *
 * CSV ustunlari: type(staff|player), email, password, role, id (o'yinchining litsenziya raqami), name
 *
 * Qoidalar:
 *  - type faqat `staff` yoki `player`; boshqasi — xato.
 *  - staff roli faqat ALLOWED_STAFF_ROLES dan (SUPERADMIN fayl orqali YARATILMAYDI).
 *  - Boshqaruvchi parollari serverdagi parol siyosatidan o'tadi (≥14 belgi, maxsus belgi ...).
 *  - Tiklashda: status O'ZGARMAYDI (bloklangan bloklangan qoladi), barcha sessiyalar bekor qilinadi,
 *    xato urinishlar hisoblagichi va blok tozalanadi, birinchi kirishda almashtirish majburiy.
 *  - Parollar hech qachon konsolga chiqarilmaydi.
 */
const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Ishlatish: node scripts/apply-accounts.cjs <akkauntlar.csv> [--apply] [--reset-staff] [--reset-email=a@x,b@y]');
  process.exit(1);
}
const KNOWN_FLAGS = /^--(apply|reset-staff|reset-email=.+)$/;
const badFlag = flags.find((f) => !KNOWN_FLAGS.test(f));
if (badFlag) { console.error(`Noma'lum parametr: ${badFlag}`); process.exit(1); }
const apply = flags.includes('--apply');
const resetStaff = flags.includes('--reset-staff');
const named = new Set(
  flags.filter((f) => f.startsWith('--reset-email=')).flatMap((f) => f.slice('--reset-email='.length).split(','))
    .map((e) => e.trim().toLowerCase()).filter(Boolean),
);

/** Fayl orqali beriladigan boshqaruvchi rollari. SUPERADMIN va PLAYER — yo'q. */
const ALLOWED_STAFF_ROLES = new Set(['ADMIN', 'OPERATOR', 'EDITOR', 'REFEREE', 'COACH', 'STREAM', 'SCREEN']);

// Parol siyosati — server bilan BIR XIL kod (src/common/password-policy.ts → build qilingan nusxa)
let policy;
try {
  policy = require(path.join(__dirname, '..', 'dist', 'src', 'common', 'password-policy.js'));
} catch {
  console.error('dist/src/common/password-policy.js topilmadi — avval `pnpm build` (yoki API konteyneri ichida ishga tushiring)');
  process.exit(1);
}

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

(async () => {
  const [head, ...data] = parseCsv(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')).filter((r) => r.length > 1);
  const rows = data.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));

  // Takroriy email — parallel ishchilar bir-birini bosib ketmasin; avval to'xtatamiz
  const seen = new Map();
  for (const r of rows) {
    const e = (r.email || '').toLowerCase();
    seen.set(e, (seen.get(e) ?? 0) + 1);
  }
  const dups = [...seen].filter(([e, n]) => e && n > 1).map(([e]) => e);
  if (dups.length) { console.error(`Faylda takroriy email(lar): ${dups.join(', ')}`); process.exit(1); }

  const prisma = new PrismaClient();
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  const stat = { staffNew: 0, staffReset: 0, staffSkip: 0, staffProtected: 0, playerNew: 0, playerSkip: 0, playerMissing: 0, errors: 0 };
  const hash = (p) => argon2.hash(p, { type: argon2.argon2id });
  const fail = (msg) => { stat.errors++; console.log(msg); };

  const queue = rows.slice();
  async function worker() {
    for (let r; (r = queue.shift()); ) {
      try {
        const email = (r.email || '').toLowerCase();
        if (!email || !r.password) { fail(`Email yoki parol bo'sh (qator: ${email || '?'})`); continue; }
        if (r.type === 'staff') {
          const ex = await prisma.user.findUnique({
            where: { email },
            select: { id: true, firstName: true, lastName: true, mustChangePassword: true, roles: { select: { role: { select: { code: true } } } } },
          });
          const isNamed = named.has(email);
          // SUPERADMIN qatori faqat mavjud root'ni nomi bilan tiklash uchun; yaratish — yo'q
          const roleOk = ALLOWED_STAFF_ROLES.has(r.role) || (r.role === 'SUPERADMIN' && !!ex && isNamed);
          if (!roleOk || !roles[r.role]) { fail(`Rol ruxsat etilmagan yoki yo'q: ${r.role} (${email})`); continue; }

          if (ex) {
            const exRoles = ex.roles.map((x) => x.role.code);
            if (!resetStaff && !isNamed) { stat.staffSkip++; continue; }
            if (!isNamed && exRoles.includes('SUPERADMIN')) { stat.staffProtected++; console.log(`Himoyalangan (SUPERADMIN, --reset-email bilan nomlanmagan): ${email}`); continue; }
            if (!isNamed && !ex.mustChangePassword) { stat.staffProtected++; console.log(`Himoyalangan (o'z parolini qo'ygan): ${email}`); continue; }
            const policyError = policy.checkPassword(r.password, {
              privileged: policy.isPrivileged([...exRoles, r.role]),
              email,
              names: [ex.firstName, ex.lastName],
            });
            if (policyError) { fail(`Parol siyosatdan o'tmadi (${email}): ${policyError}`); continue; }
            if (!apply) { stat.staffReset++; continue; }
            const passwordHash = await hash(r.password);
            await prisma.$transaction([
              // status ATAYLAB yo'q: bloklangan hisob bloklangan qoladi
              prisma.user.update({
                where: { id: ex.id },
                data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
              }),
              // Eski sessiyalar (mustChangePassword belgisiz tokenlar) bekor qilinadi
              prisma.refreshToken.updateMany({ where: { userId: ex.id, revokedAt: null }, data: { revokedAt: new Date() } }),
            ]);
            stat.staffReset++;
          } else {
            const [firstName, ...rest] = (r.name || email.split('@')[0]).split(' ');
            const lastName = rest.join(' ') || '-';
            const policyError = policy.checkPassword(r.password, { privileged: true, email, names: [firstName, lastName] });
            if (policyError) { fail(`Parol siyosatdan o'tmadi (${email}): ${policyError}`); continue; }
            if (!apply) { stat.staffNew++; continue; }
            await prisma.user.create({
              data: { email, passwordHash: await hash(r.password), firstName, lastName, mustChangePassword: true, roles: { create: { roleId: roles[r.role] } } },
            });
            stat.staffNew++;
          }
        } else if (r.type === 'player') {
          const player = await prisma.player.findFirst({ where: { licenseNumber: r.id }, select: { id: true, userId: true, firstName: true, lastName: true } });
          if (!player) { stat.playerMissing++; continue; }
          if (player.userId || (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) { stat.playerSkip++; continue; }
          if (!apply) { stat.playerNew++; continue; }
          const passwordHash = await hash(r.password);
          await prisma.$transaction(async (tx) => {
            const u = await tx.user.create({ data: { email, passwordHash, firstName: player.firstName.slice(0, 60), lastName: player.lastName.slice(0, 60), mustChangePassword: true, roles: { create: { roleId: roles.PLAYER } } } });
            await tx.player.update({ where: { id: player.id }, data: { userId: u.id } });
          });
          stat.playerNew++;
        } else {
          fail(`Noma'lum type: "${r.type}" (${email}) — faqat staff yoki player`);
        }
      } catch (e) { fail(`XATO ${r.email}: ${String(e.message).split('\n').pop()}`); }
    }
  }
  console.log(`${rows.length} qator o'qildi. ${apply ? 'YOZILADI' : 'faqat hisobot (--apply bilan yoziladi)'}`);
  if (named.size) console.log(`Nomi bilan tiklanadiganlar: ${[...named].join(', ')}`);
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(stat);
  await prisma.$disconnect();
  if (stat.errors) process.exitCode = 2;
})();
