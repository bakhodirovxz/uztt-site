# Reyting sahifalash (pagination) — o'rnatish

Bu arxivda reyting bo'limini sahifalarga bo'lish (100 tadan, 1,2,3...54) uchun
kerakli fayllar bor. Bazaga hech qanday o'zgarish, migratsiya yoki import
KERAK EMAS — bu faqat kod o'zgarishi.

## O'zgargan fayllar va qayerga qo'yish kerak

1. `rankings.service.ts` →
   `apps/api/src/modules/rankings/rankings.service.ts`
2. `rankings.controller.ts` →
   `apps/api/src/modules/rankings/rankings.controller.ts`
3. `rankings-page.tsx` →
   `apps/web/src/app/(site)/[locale]/rankings/page.tsx`
4. `home-page.tsx` →
   `apps/web/src/app/(site)/[locale]/page.tsx`
5. `uz.json` → `apps/web/src/messages/uz.json`
6. `en.json` → `apps/web/src/messages/en.json`
7. `ru.json` → `apps/web/src/messages/ru.json`

## Nima o'zgardi

- Backend (`/rankings` API): endi `page` va `pageSize` so'rov parametrlarini
  qabul qiladi (`?page=2&pageSize=100`). Standart: 100 tadan. Reyting o'rni
  (rank) hamon TO'LIQ ro'yxat bo'yicha to'g'ri hisoblanadi — faqat sahifaga
  bo'lish oxirida qilinadi, shuning uchun 2-sahifada ranklar noto'g'ri
  boshlanmaydi (masalan 101, 102, ... bo'lib davom etadi).
- Frontend reyting sahifasi: jadval ostida sahifalash tugmalari
  (‹ 1 2 3 ... 54 ›) va "Jami: N" (nechta o'yinchi borligi) ko'rsatiladi.
- Bosh sahifadagi reyting preview bloki ham yangi API formatiga moslashtirildi
  (u hamon faqat top-5 ni ko'rsatadi, o'zgarish yo'q ko'rinishda).

## O'rnatish

`pnpm dev` allaqachon ishlab turgan bo'lsa, fayllarni ustidan almashtirib
qo'yish kifoya — Next.js va NestJS avtomatik qayta yuklaydi (hot reload).
Agar biror narsa g'alati ko'rinsa, terminalda `Ctrl+C` bosib, qaytadan
`pnpm dev` ni ishga tushiring.

Bazaga hech narsa tegilmagan, `prisma migrate` yoki import skriptlarini
ishlatish shart emas.
