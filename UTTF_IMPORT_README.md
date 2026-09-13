# uttf.uz'dan ma'lumot import qilish — qo'llanma

Bu paket uttf.uz'ning ochiq API'laridan (frontend ishlatadigan `/api/table-tennis/...`
endpointlar) yig'ilgan ma'lumotlarni o'z ichiga oladi:

- **Klublar**: 58 ta, to'liq (manzil, telefon, GPS, murabbiy, stol soni, logotip)
- **O'yinchilar reytingi (Yakkalik)**: 5520 ta o'yinchi — bazaga import qilingan
- **Yangiliklar**: 11 ta, to'liq matn + rasm bilan
- **Rasmlar**: 2100 ta (o'yinchi/klub/yangilik), `apps/web/public/uttf-import/` papkasida

Qo'shimcha xom ma'lumot (hozircha bazaga yozilmagan, kelajakda kerak bo'lsa ishlatish uchun):
- `uttf-full-export.json` — Juftlik (379), Aralash juftlik (409), Jamoaviy (369) reytinglar
  ham shu faylda bor (`ratingsDoubles`, `ratingsMixed`, `ratingsTeams` kalitlari).
  Bular hali alohida modelga ega emas (Player/Club'dan farqli — jamoaviy/juftlik
  reyting o'z sxemasini talab qiladi), shuning uchun bazaga yozilmagan.

## Nima o'zgardi

1. `apps/api/prisma/schema.prisma` — yangi `Club` modeli qo'shildi, `Player`ga
   `clubId` (FK) maydoni qo'shildi.
2. `apps/api/prisma/migrations/20260816161010_add_club_model/migration.sql` —
   shu o'zgarishning SQL migratsiyasi (qo'lda yozilgan, chunki bu muhitda Prisma
   binary internetdan yuklab bo'lmadi — sizning muhitingizda muammosiz ishlaydi).
3. `apps/api/scripts/import-uttf-data.py` — import skripti (Python, psycopg2 kerak).

## Ishga tushirish — usul A (tavsiya etiladi, eng oson): tayyor SQL fayl

`uttf-import-data.sql` — bu jo'natilgan hamma narsa (58 klub + 5520 o'yinchi +
11 yangilik) allaqachon tayyor `INSERT` buyruqlari holida. Hech qanday
Python/bog'liqlik kerak emas — faqat bitta buyruq:

```bash
cd apps/api

# 1. Sxema o'zgarishini qo'llash (Club modeli) — Postgres ishga tushgan bo'lsin: pnpm db:up
pnpm prisma migrate deploy
# yoki muammo bo'lsa:
#   psql "$DATABASE_URL" -f prisma/migrations/20260816161010_add_club_model/migration.sql

pnpm prisma generate   # TypeScript tiplarida Club paydo bo'lishi uchun

# 2. Ma'lumotlarni yozish (loyiha tub papkasidan)
cd ../..
psql "$DATABASE_URL" -f uttf-import-data.sql
```

Bu fayl `BEGIN ... COMMIT` bilan o'ralgan — xatolik bo'lsa hech narsa
yozilmaydi (hammasi yoki hech narsa). **Faqat bir marta ishga tushiring** —
qayta ishga tushirsangiz `id`/`slug` unique cheklovlariga urilib xato beradi
(chunki bu tayyor `INSERT`lar, `ON CONFLICT` mantig'i yo'q).

## Ishga tushirish — usul B: Python skript (qayta ishga tushirish uchun qulay)

Agar keyinchalik yangilangan ma'lumotni qayta import qilish kerak bo'lsa,
`apps/api/scripts/import-uttf-data.py`dan foydalaning — bu idempotent
(`ON CONFLICT ... DO NOTHING`, klub `external_id` / o'yinchi `license_number`
orqali dublikatning oldi olinadi):

```bash
cd apps/api
pip install psycopg2-binary
UTTF_EXPORT_PATH=../../uttf-full-export.json \
UTTF_MANIFEST_PATH=../../images-manifest.json \
DATABASE_URL="$DATABASE_URL" \
python3 scripts/import-uttf-data.py
```

## Bilinishi kerak bo'lgan cheklovlar

- O'yinchilarning **tug'ilgan sanasi** aniq emas — faqat "yoshi" bor edi, shundan
  taxminiy sana (yil-01-01) hisoblangan.
- **Yosh toifasi** (U11, U13...) avtomatik belgilanmagan — kerak bo'lsa qo'lda yoki
  yosh bo'yicha keyinroq skript bilan to'ldirish mumkin.
- Reyting ballari original saytda o'nlik kasr edi (masalan 700.04) — `rankingPoints`
  Int bo'lgani uchun yaxlitlangan.
- Yangiliklar matni **inglizcha** holda import qilindi (`NewsTranslation.locale = "en"`),
  chunki manba API shunday qaytardi — uz/ru tarjimasi hozircha yo'q.
- 5520 o'yinchidan atigi 276 tasi bizning 58 ta rasmiy klub ro'yxatidan biriga
  bog'langan (`club_id`) — qolganlari klub nomi matn sifatida saqlangan
  (`Player.club`), chunki ular ro'yxatdagi 58 klubga kirmaydi (masalan sport
  maktablari yoki hali akkreditatsiya qilinmagan klublar).
