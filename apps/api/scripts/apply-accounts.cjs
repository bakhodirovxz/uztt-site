#!/usr/bin/env node
/**
 * Berilgan parollar fayli (akkauntlar.csv) bo'yicha hisoblarni bazaga yaratadi — fayl bilan baza DOIM mos bo'ladi.
 *   cd apps/api && node scripts/apply-accounts.cjs ../../akkauntlar.csv            # faqat hisobot (hech narsa yozmaydi)
 *   cd apps/api && node scripts/apply-accounts.cjs ../../akkauntlar.csv --apply    # yaratadi
 *   ... --apply --reset-staff     # mavjud boshqaruvchilarning parolini faylnikiga almashtiradi
 * CSV ustunlari: type(staff|player), email, password, role, id (o'yinchining litsenziya raqami), name
 * Hamma hisobda `mustChangePassword = true` — birinchi kirishda parol almashtiriladi.
 * Mavjud o'yinchi hisobi (userId bor) va mavjud email'ga TEGILMAYDI (--reset-staff dan tashqari).
 */
const fs = require('fs');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error('Ishlatish: node scripts/apply-accounts.cjs <akkauntlar.csv> [--apply] [--reset-staff]'); process.exit(1); }
const apply = flags.includes('--apply');
const resetStaff = flags.includes('--reset-staff');

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
  const prisma = new PrismaClient();
  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  const stat = { staffNew: 0, staffReset: 0, staffSkip: 0, playerNew: 0, playerSkip: 0, playerMissing: 0, errors: 0 };
  const hash = (p) => argon2.hash(p, { type: argon2.argon2id });

  const queue = rows.slice();
  async function worker() {
    for (let r; (r = queue.shift()); ) {
      try {
        const email = r.email.toLowerCase();
        if (r.type === 'staff') {
          const role = roles[r.role];
          if (!role) { console.log(`Rol yo'q: ${r.role} (${email})`); stat.errors++; continue; }
          const ex = await prisma.user.findUnique({ where: { email } });
          if (ex && !resetStaff) { stat.staffSkip++; continue; }
          if (!apply) { ex ? stat.staffReset++ : stat.staffNew++; continue; }
          const passwordHash = await hash(r.password);
          if (ex) { await prisma.user.update({ where: { id: ex.id }, data: { passwordHash, mustChangePassword: true, status: 'ACTIVE' } }); stat.staffReset++; }
          else {
            const [firstName, ...rest] = (r.name || email.split('@')[0]).split(' ');
            await prisma.user.create({ data: { email, passwordHash, firstName, lastName: rest.join(' ') || '-', mustChangePassword: true, roles: { create: { roleId: role } } } });
            stat.staffNew++;
          }
        } else {
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
        }
      } catch (e) { stat.errors++; console.log(`XATO ${r.email}: ${e.message.split('\n').pop()}`); }
    }
  }
  console.log(`${rows.length} qator o'qildi. ${apply ? 'YOZILADI' : 'faqat hisobot (--apply bilan yoziladi)'}`);
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(stat);
  await prisma.$disconnect();
})();
