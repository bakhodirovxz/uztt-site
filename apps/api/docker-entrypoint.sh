#!/bin/sh
set -e

echo "[uztt-api] migratsiyalar qo'llanmoqda..."
npx prisma migrate deploy

# Seed idempotent (upsert) — birinchi ishga tushirishda ma'lumot yaratadi,
# keyingilarida mavjudini yangilaydi. O'chirish: SEED_ON_BOOT=0
if [ "${SEED_ON_BOOT:-1}" = "1" ]; then
  echo "[uztt-api] seed ishga tushmoqda..."
  node dist/prisma/seed.js || echo "[uztt-api] seed xatosi (davom etamiz)"
fi

echo "[uztt-api] server ishga tushmoqda..."
exec node dist/src/main.js
