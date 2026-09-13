# O'yinchi rasmi/yoshi + Yangiliklar tarjimasi — o'rnatish

Ikkita alohida tuzatish:

## 1. O'yinchilar sahifasida rasm va yosh

Sabab: rasm (`photoUrl`) va tug'ilgan sana (`birthDate`) bazada bor edi
(uttf.uz'dan import qilingan), lekin frontend ularni umuman ko'rsatmasdi.

**Kod fayllari** (ustidan almashtiring):

1. `rankings.service.ts`... yo'q — bu safar boshqa fayllar:
   - `players.service.ts` → `apps/api/src/modules/players/players.service.ts`
   - `players-list-page.tsx` → `apps/web/src/app/(site)/[locale]/players/page.tsx`
   - `players-detail-page.tsx` → `apps/web/src/app/(site)/[locale]/players/[slug]/page.tsx`

Bazaga hech qanday o'zgarish/migratsiya kerak emas — bu mavjud maydonlarni
frontendga chiqarish, xolos. `pnpm dev` qayta ishga tushgach darhol ko'rinadi.

Nima qo'shildi: o'yinchi ro'yxati va profilida endi asl rasm (bo'lmasa —
ismi bosh harflaridan doira, avvalgidek), yosh toifasi belgisi (U15, U19...)
va tug'ilgan yildan hisoblangan taxminiy yosh ko'rsatiladi. Profilda klub
logotipi ham chiqadi (agar klub bazada bo'lsa).

## 2. Yangiliklar bo'limi — o'zbek/rus tarjimasi

Sabab: 11 ta yangilik faqat **inglizcha** matn bilan import qilingan edi.
Sayt kodi yangilikni ko'rsatishda so'ralgan til topilmasa — "uz"ga qaytadi,
lekin "uz" tarjimasi umuman yo'q edi, shuning uchun Yangiliklar bo'limi
har doim BO'SH chiqardi (tilidan qat'i nazar).

Bu safar 11 ta yangilikning barchasi qo'lda o'zbek va rus tiliga to'liq
tarjima qilindi (sarlavha + matn) va SQL fayl sifatida tayyorlandi:

`uttf-news-i18n.sql` — repo tub papkasiga (`uztt-site/`) qo'yildi.

**Ishga tushirish** (faqat bitta buyruq, xavfsiz — bir necha marta ishga
tushirsangiz ham dublikat yozmaydi, `ON CONFLICT DO NOTHING` bilan):

```bash
cd uztt-site/apps/api
set -a; source .env; set +a
cd ..
psql "$DATABASE_URL" -f uttf-news-i18n.sql
```

Muvaffaqiyatli bo'lsa, oxirida `COMMIT` chiqadi. Shundan keyin `pnpm dev`ni
qayta ishga tushirish shart emas — bu faqat bazaga yozuv, kod o'zgarmagan.
Brauzerda "Yangiliklar" bo'limini yangilab ko'ring.

## Eslatma

Musobaqalar (tournaments) bo'limi hali ishlanmagan — bu alohida, kattaroq
vazifa (uttf.uz'dan qayta ma'lumot yig'ish kerak), tez orada davom etaman.
