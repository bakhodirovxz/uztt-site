# Serverga yuklash — qadamma-qadam

Barcha buyruqlar `D:\uztt-site` (yoki serverdagi loyiha papkasi) ichida. Hech narsa avtomatik push qilinmaydi.

## 0. Tayyorgarlik (5 daqiqa)
1. Baza zaxirasi (MAJBURIY):
   `docker compose exec -T postgres pg_dump -U <DB_USER> <DB_NAME> | gzip > backup_$(date +%F_%H%M).sql.gz`
2. Oldingi Docker image tegini yozib qo'ying (orqaga qaytarish uchun).
3. Server `.env` ga qo'shing (ikkalasi birga bo'lishi shart):
   `TELEGRAM_BOT_TOKEN=...`  `TELEGRAM_CHAT_ID=...`

## 1. Patchni qo'llash (alohida branchda)
```
git checkout -b feature/showcase-broadcast
git am showcase-broadcast.patch
```
Patch HEAD `7d64ab0` ustiga yozilgan. Ishchi papkangizda tugallanmagan o'zgarishlar bo'lsa, avval `git stash` qiling.
`git am` xato bersa: `git am --abort` va toza klonda qo'llang.

## 2. Tekshiruv (deploydan oldin)
```
cd apps/api && npx tsc --noEmit && npx jest
cd ../web && npx tsc --noEmit
```

## 3. Deploy (main ga merge = avtomatik deploy)
```
git checkout main && git merge --no-ff feature/showcase-broadcast && git push
```
API konteyneri yig'ilganda `fontconfig` + `font-dejavu` o'rnatiladi (Telegram rasmidagi matn uchun).
Migratsiyalar avtomatik (yoki qo'lda: `npx prisma migrate deploy`):
- `20261030120000_overlay_ads` — reklama jadvali
- `20261031090000_points_non_negative` — manfiy ballarni 0 qiladi + CHECK (minus bo'lmasin)
- `20261031120000_official_rating` — rasmiy reyting (Nizom): daraja rejimi (OFFICIAL/LEGACY), K, yangi `CUP` darajasi
- `20261031130000_group_stage` — guruh bosqichi jadvallari (guruhlar, a'zolar, o'yinlarda group_id)
- `20261031140000_match_timeout` — taym-aut maydonlari (+ `MatchEventType.TIMEOUT`)
- `20261031150000_appeals` — apellyatsiya/protestlar jadvali
- `20261031160000_third_place` — 3-o'rin uchun o'yin (`MatchStage.THIRD_PLACE`, yutqazgan keyingi o'yinga)
- `20261031170000_regions_uz` — hududlar nomini o'zbekchaga o'tkazadi (players, clubs, teams)

**Diqqat:** barcha mavjud darajalar OFFICIAL rejimga o'tadi (Nizom formulalari). Eski usulga qaytarish:
`UPDATE tournament_levels SET rating_mode='LEGACY' WHERE code='NATIONAL';`
Musobaqa yakunida bonus: admin → `POST /api/rankings/tournaments/<id>/bonuses` (ko'rib chiqish), `?apply=1` (qo'llash, bir marta).
Batafsil: QOIDALAR.md

## 4. O'yinchilar va ballarni tekshirish / tuzatish
`/root/uttf-scrape/uttf-full-export.json` serverda bor. Skript avval FAQAT HISOBOT beradi:
```
cd apps/api/scripts
DATABASE_URL=postgresql://... python3 audit-players.py            # faqat hisobot
DATABASE_URL=postgresql://... python3 audit-players.py --apply    # yo'qlarni qo'shadi, manfiy -> 0 (zaxira jadval bilan)
DATABASE_URL=postgresql://... python3 audit-players.py --apply --sync-points   # + saytda ball olmaganlarni eksportga tenglaydi
```
Eslatma: `--sync-points` saytda o'yin orqali ball olgan o'yinchilarga TEGMAYDI.
Zaxira: `players_bak_YYYYMMDD`, `partnerships_bak_YYYYMMDD`, `teams_bak_YYYYMMDD`.

## 5. Efir tekshiruvi (deploydan keyin)
- Admin panel → "Overlay reklama": bitta reklama yuklab, overlayda ko'ring.
- Test o'yin: o'yinchi profili chiqishi, tugaganda reyting animatsiyasi.
- `POST /api/showcase/telegram/test` (admin) — Telegramga xabar + ikki rasm kelishi.

## Orqaga qaytarish
Oldingi image tegiga qaytaring. Migratsiyalar eski kod bilan ham ishlaydi
(yangi jadval + CHECK). CHECK ni olib tashlash kerak bo'lsa:
`ALTER TABLE players DROP CONSTRAINT players_ranking_points_nonneg;` (partnerships/teams uchun ham shunday).

## Yangi imkoniyatlar (admin, Swagger: /api/docs)
- Guruhlar: `POST /api/groups/category/:categoryId` {groupCount, advancing, bestOf, modifiedSnake}; jadval: `GET /api/groups/category/:categoryId` (ochiq); setkaga: `POST /api/groups/category/:categoryId/advance`
- Taym-aut: hakam ekranida tugma (har o'yinchiga 1 marta); TV va overlayda ekran markazida katta panel
- Admin → Musobaqa darajalari: K koeffitsiyenti va hisob rejimi (Rasmiy/Eski)
- Saytda musobaqa sahifasida "Guruhlar" bo'limi
- Reytingdan chiqarish: `POST /api/rankings/players/:id/exclude|restore`, nomzodlar: `GET /api/rankings/inactive?years=2`
- Apellyatsiya: `POST /api/appeals` (o'yinchi), `GET /api/appeals`, `POST /api/appeals/:id/decision` (admin)
- To'liq holat: QOIDALAR.md

## O'yinchi rasmlari
Rasmlar serverda `apps/web/public/uttf-import/players/` ichida bo'lishi kerak (mavjud serverda shunday). Lokal kompyuterda rasmsiz bo'lsa, efir sahnasida bosh harflar chiqadi.

## v7: arizalar, klublar, hakam tayinlash, rasmlar, xavfsizlik
1. **Bog'liqliklar yangilandi** (Next 16.2.12 da critical RCE bor edi): `pnpm install --frozen-lockfile` → `pnpm audit --prod` (0 bo'lishi kerak) → `pnpm build`. Next 16.4.3 qurilishi menda tekshirildi (Google Fonts internetsiz o'rnatishda so'raladi, serverda muammo yo'q).
2. **Migratsiya** `20261031180000_applications_clubs_referee_assignment` avtomatik qo'llanadi; ruxsatlar (`applicant.review`, `referee.assign`, `club.manage`) migratsiyada beriladi (production'da seed ishlamaydi). Tekshiruv: `SELECT code FROM permissions WHERE code IN ('applicant.review','referee.assign','club.manage');`
3. **Kichik rasmlar** (bir marta, serverda): `cd apps/api && node scripts/make-thumbs.cjs` — `uttf-import/players/thumb/*.webp` yaratadi. Yangi yuklangan rasmlar uchun kichik nusxa avtomatik.
4. **nginx**: `deploy/stoltennis.uz.nginx.conf` da `/uploads/players/` 30 kun immutable kesh (yangi blok) — nginx'ni qayta yuklang.
5. **Mavjud hakamlar**: eski hakam profillari migratsiyada avtomatik `APPROVED` bo'ladi, shuning uchun tayinlashda ishtirok etadi. Ishtirok etmasligi kerak bo'lganlar uchun `referee_profiles.available=false`.
6. **Yangi sahifalar**: `/join/referee`, `/join/coach`, `/clubs`, `/clubs/open`; panel: Arizalar, Hakamlar tayinlash; TV: `/screen/draw/<categoryId>?view=groups|bracket`; OBS: `/overlay/draw/<categoryId>?view=groups|bracket` (kategoriya id sini musobaqa sahifasi/Swagger'dan oling).
7. **Hakam tayinlash qoidasi**: setka yoki guruh saqlanganda va har o'yin tugaganda hakami yo'q o'yinlarga avtomatik; tayinlangandan so'ng o'yin kodini faqat shu hakam (yoki `match.manage`) kirita oladi. Qo'lda almashtirish: panel → Hakamlar tayinlash.
8. Xavfsizlik: `SECURITY.md`.

## v11: hisoblar, parollar, SEO, yosh segmentlari
1. **Migratsiya** `20261101120000_must_change_password` (avtomatik).
2. **Hisoblar (serverda):** `akkauntlar.csv` shu loyihaning ildiziga (yoki istalgan joyga) qo'yiladi:
   ```
   cd apps/api
   node scripts/apply-accounts.cjs ../../akkauntlar.csv            # faqat hisobot
   node scripts/apply-accounts.cjs ../../akkauntlar.csv --apply    # yaratadi (5520 o'yinchi ~10 daqiqa)
   ```
   Mavjud hisoblarga tegmaydi. `--reset-staff` boshqaruvchilar parolini faylnikiga almashtiradi, LEKIN
   SUPERADMIN'ga va parolini allaqachon o'zi almashtirgan hisoblarga tegmaydi — ularni faqat aniq nomlab:
   `--reset-email=a@uztt.uz,b@uztt.uz`. Hisob holati (BLOCKED va h.k.) saqlanadi; reset bo'lganda eski
   sessiyalar bekor qilinadi va login blok tozalanadi. CSV orqali SUPERADMIN roli berib bo'lmaydi.
   Hammasida birinchi kirishda parol almashtirish majburiy.
   **Eslatma (2026-11):** jonli serverdagi barcha hisoblar parollari 2026-09 da tasodifiy 16 belgiliga
   almashtirilgan (`/root/uztt-parollar.txt`) — demo parollar yo'q.
3. **SEO:** serverning `.env` ga `NEXT_PUBLIC_SITE_URL=https://stoltennis.uz` (canonical, sitemap, Open Graph shu manzildan quriladi). Tekshiruv: `/sitemap.xml` (≈5600 manzil), `/robots.txt`.
4. Sitemap barcha o'yinchilarni (sahifalab) o'z ichiga oladi — birinchi so'rovda bir necha soniya oladi, keyin 1 soat keshlanadi.
5. Parol fayllarini (xlsx/csv) **xavfsiz joyda saqlang** va o'yinchilarga alohida-alohida bering; chatga/ommaviy guruhga tashlamang.

## v12: Telegram e'lonlari, uttf.uz sinxronizatsiyasi, yosh segmentlari, xavfsizlik
1. **Migratsiyalar** (avtomatik): `must_change_password`, `login_lockout`, `news_external_id`.
2. **Telegram** (serverning `.env`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (ommaviy kanal) — o'yin natijasi (2 ta rasm), yangi yangilik (muqova bilan), yangi musobaqa, setka/guruhlar tayyor, reyting yangilandi (top-3). Ixtiyoriy: `TELEGRAM_ADMIN_CHAT_ID` (yopiq admin guruh: yangi hakam/murabbiy/klub/o'yinchi arizalari — shaxsiy ma'lumotsiz), `PUBLIC_SITE_URL=https://stoltennis.uz` (havolalar uchun), `TELEGRAM_EVENTS=match,news,tournament,draw,ranking,admin` (keraksizini olib tashlang). Tekshiruv: `POST /api/showcase/telegram/test`.
3. **uttf.uz dan olish:** lokal `6-uttf-sync.bat`, serverda esa admin → Swagger `/api/docs` → `uttf-sync`: `GET /probe` (aloqa va javob shakli), `POST /run` `{scope, dryRun:false}`: `news` (barcha eski yangiliklar, uz/ru/en, muqova rasmi bilan), `tournaments`, `tournament-names`, `matches`, `clubs`, `players`, `photos`. Avval `dryRun:true` (standart) bilan ko'ring.
4. **Hisoblar:** `akkauntlar.csv` + `node scripts/apply-accounts.cjs` (v11 bo'limi). Root parol — `1-BOSHQARUVCHILAR-parollar.xlsx`.
5. **Yosh segmentlari** kumulyativ (U-N = N va undan kichik hamma): reyting, o'yinchilar sahifasi, kesimlar, juftlik va jamoalar.
