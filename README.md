# O'zbekiston Stol Tennisi Federatsiyasi — rasmiy platforma

worldtabletennis.com darajasidagi to'liq federatsiya sayti: musobaqalar, jonli hisoblar,
reytinglar, o'yinchilar, yangiliklar + hakam paneli, OBS overlay va admin panel.

## Arxitektura

```
apps/api/       NestJS 11 + Prisma 6 + PostgreSQL 17 — API, Socket.io, RBAC, AES-256
apps/web/       Next.js 16 + Tailwind v4 + next-intl — uz/ru/en sayt, panel, overlay
packages/shared/ Umumiy tiplar va kontraktlar
tools/visual-parity/ WTT bilan yonma-yon dizayn solishtirish (Playwright)
legacy/         Eski MVP (Phase 1 paritetgacha saqlanadi)
```

## Ishga tushirish (Docker — tavsiya, serverdagi kabi)

Talab: Docker Desktop (yoki docker + compose).

```bash
# 1. Sozlamalar
cp .env.example .env
# .env ichida JWT_SECRET, JWT_REFRESH_SECRET, DATA_ENCRYPTION_KEY, POSTGRES_PASSWORD
# qiymatlarini to'ldiring. Generatsiya:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT uchun
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # AES kalit (64 hex)

# 2. Yig'ish va ishga tushirish
docker compose build
docker compose up -d

# Sayt:  http://localhost:3000
# API:   http://localhost:4000/api  (Swagger: /api/docs — faqat dev rejimda)
```

Birinchi ishga tushirishda migratsiyalar va seed avtomatik qo'llanadi (`SEED_ON_BOOT=1`).

## Dev rejim (hot reload, hostda)

Talab: Node 22+, pnpm (`npm i -g pnpm`), Docker (faqat Postgres uchun).

```bash
pnpm install
docker compose up -d postgres
pnpm --filter @uztt/api prisma:migrate   # birinchi marta
pnpm --filter @uztt/api prisma:seed
pnpm dev            # api :4000 + web :3000 parallel
```

## Demo hisoblar (seed)

Seed **faqat lokal ishlab chiqish** uchun demo hisoblar yaratadi:
`root@`, `admin@`, `operator@`, `mudir@`, `muharrir@`, `murabbiy@`,
`oyinchi@`, `hakam1..4@`, `overlay1..4@`, `screen1..4@` (hammasi `@uztt.uz`).

Parollar `apps/api/prisma/seed.ts` ichidagi `USERS` massivida —
**ular ataylab bu yerda ro'yxat qilinmagan**, chunki bu repozitoriy ochiq.

**Production'da seed ishlamaydi.** Ishga tushirish uchun aniq ruxsat kerak:

```bash
NODE_ENV=production SEED_ALLOW_PROD=1 \
  SEED_ADMIN_PASSWORD='<kuchli parol>' \
  SEED_ROOT_PASSWORD='<kuchli parol>' \
  pnpm --filter @uztt/api prisma:seed
```

Bu rejimda faqat `admin@` va `root@` yaratiladi (parollar env'dan, fallback
yo'q), demo hisoblar esa umuman yaratilmaydi — qolgan hisoblarni admin
panel orqali qo'shing.

## Rollar: root va operator

**Root (SUPERADMIN)** — hamma huquqlar. `Kabinet → Foydalanuvchilar`da yangi hisob
ochadi, rol biriktiradi/oladi, bloklaydi, parolni tiklaydi (barcha sessiyalari
bekor bo'ladi) va o'chiradi. Tizimda kamida bitta faol root qolishi majburiy —
oxirgisini bloklab yoki o'chirib bo'lmaydi.

**Operator (musobaqa kotibi)** — musobaqa jarayonini olib boradi, lekin
foydalanuvchilar va rollarga tegmaydi:

| Vazifa | Qayerda |
|---|---|
| Turnir ochish, guruh (yosh + yakka/juftlik/aralash/jamoaviy) yaratish | Kabinet → Musobaqalar |
| Qatnashchi qo'shish, ariza tasdiqlash/rad etish | Kabinet → Musobaqalar → guruh ustiga bosing |
| Turnirdan chetlatish (**sabab majburiy**, kim chetlatgani yoziladi) | O'sha yerda |
| O'yinlar jadvali va qura (setka) | Kabinet → Musobaqalar / O'yinchilar |
| Yig'ilgan ballni tuzatish (izoh majburiy, tarix saqlanadi) | Kabinet → O'yinchilar |
| Yangilik kiritish | Kabinet → Yangiliklar |
| Jonli efir havolalari (barcha stollar) | Kabinet → Translatsiya |

## O'yinchi ro'yxatdan o'tishi

Ro'yxatdan o'tishda o'yinchi jinsini, tug'ilgan sanasini va **qaysi yosh
toifalarida ishtirok etmoqchi** ekanini belgilaydi (yoshiga mos bo'lmagan toifa
server tomonda rad etiladi). Pasport ma'lumotlari va rasmi AES-256 bilan
shifrlanadi. **Administrator tasdiqlamaguncha turnirga yozila olmaydi.**

Turnirga yozilishda yosh toifasi bilan birga **guruh** tanlanadi: erkaklar/ayollar
yakka, juftlik, aralash juftlik yoki jamoaviy. Juftlikda sherik (aralash juftlikda
qarama-qarshi jinsda), jamoaviy guruhda jamoa nomi talab qilinadi.

## Translatsiya: overlay va zal monitori

Har bir stolga **uchta hisob** to'g'ri keladi: hakam (ballarni kiritadi) → overlay
(YouTube translatsiyasi uchun) → monitor (zaldagi katta ekran). Hakam ochko, sariq
yoki qizil kartochka bergan zahoti ikkalasi ham socket orqali darhol yangilanadi.

| Kanal | URL | Qayerda ochiladi |
|---|---|---|
| Overlay | `/overlay/table/<stol>` | OBS → Browser Source, 1920×1080, fon shaffof |
| Zal monitori | `/screen/<stol>` | Katta ekran brauzeri, F11 (to'liq ekran) |

Operator o'z hisobi bilan kirsa, **Kabinet → Translatsiya** bo'limida o'ziga
biriktirilgan stol va tayyor havolalar ko'rinadi. Stol–kanal biriktiruvi admin
tomonidan `POST /api/stream/channels` orqali boshqariladi (stol soni cheklanmagan).

Scorebug WTT streaming ko'rsatmalariga muvofiq: o'yinchi ismlari (FAMILIYA Ism),
setlar va joriy ochko, podacha indikatori, sariq/qizil kartochkalar,
SETPOINT/MATCHPOINT ko'rsatkichi, o'yin yo'q paytda esa keyingi o'yinlar jadvali.

## Xavfsizlik dizayni (qisqa)

- **Auth:** argon2id + JWT access (15 min) + rotating refresh (30 kun, family reuse-detection), httpOnly SameSite=Lax cookie'lar
- **RBAC:** rollar va permissionlar bazada (`roles`, `permissions` jadvallar) — yangi rol qo'shish uchun kod o'zgarmaydi; guard'lar permission tekshiradi
- **AES-256-GCM:** pasport ma'lumotlari/rasmlari uchun `CryptoService` (key rotation bilan); kalit `.env`da majburiy
- **Validatsiya:** global whitelist ValidationPipe — noma'lum maydonlar rad etiladi (mass assignment himoyasi)
- **CSRF:** Origin/Referer allowlist guard; **Rate limiting:** global + login 20/15min/IP
- **HSTS** faqat nginx'da (TLS tugatuvchi) — API uni takrorlamaydi, aks holda HTTP orqali ochilganda brauzerda butun `localhost` HTTPS'ga majburlanardi
- Sirlarning hech biri kodda default qiymatga ega emas — `.env`siz API boot qilmaydi

## Kontent keshini yangilash (ISR)

Yangilik/sahifa/media o'zgarganda API web'ning `/api/revalidate` endpointini
chaqiradi va Next kesh teglarini tozalaydi — sahifa darhol yangilanadi, deploy
shart emas. `.env` da ikkalasi ham berilishi kerak (bittasi berilsa API boot
qilmaydi — noto'liq sozlama sukut bilan o'tib ketmasin):

```bash
WEB_REVALIDATE_URL=http://web:3000/api/revalidate   # Docker ichida
REVALIDATE_SECRET=<kamida 16 belgi>
```

Sozlanmagan bo'lsa sayt baribir ishlaydi: kontent `revalidate` muddati (5 daqiqa)
o'tgach yangilanadi.

## Qidiruv

Postgres FTS (`tsvector`, til bo'yicha: ru → russian, en → english, uz → simple)
+ `pg_trgm` o'xshashligi. Sarlavhadagi qidiruv maydoni o'yinchilarni yozayotganda
taklif qiladi (`/api/search/typeahead`), to'liq natijalar `/search` sahifasida
guruhlangan holda chiqadi.

## Musobaqa darajalari = reglament

Har daraja o'z **ball jadvaliga** ega. Musobaqa ochilganda daraja tanlanadi va
o'yinlar aynan shu reglament bo'yicha reyting balli beradi:

| Holat | Qachon beriladi |
|---|---|
| **Ishtirok uchun** | o'yinchi musobaqadagi birinchi o'yinini o'ynaganda, bir marta |
| **Guruhdan chiqish** | setka tuzilganda guruh bosqichini o'tganlarga |
| **Har bir g'alaba** | har yutuq uchun — guruhda ham, setkada ham |
| **Finalda g'olib** | chempionga g'alaba ballidan tashqari |

Hakam o'yinni yakunlashi bilan ballar **avtomatik** qo'shiladi va reyting
darhol yangilanadi — qo'lda hech narsa kiritilmaydi. Har yozuv ball tarixida
sababi bilan qoladi (masalan «Har bir g'alaba uchun»).

Boshqarish: **Panel → Darajalar** (`tournament.manage` huquqi). U yerda yangi
daraja qo'shiladi, ball jadvali tahrirlanadi; musobaqasi bor darajani o'chirib
bo'lmaydi. Reglament musobaqa sahifasida ham ochiq ko'rinadi.

Reglament kiritilmagan daraja eski usulda ishlaydi (bosqich balli ×
koeffitsiyent) — mavjud ma'lumot buzilmasligi uchun.

## Reyting kesimlari (▲▼)

Har dushanba 03:00 da cron reyting kesimini oladi (`ranking_snapshots`). Reyting
jadvalidagi ▲▼ ko'rsatkichi joriy o'rin bilan oxirgi kesimdagi o'rin farqi.
Kesimni qo'lda ham olish mumkin: **Panel → O'yinchilar → Reyting kesimlari**.
Eski kesimni ko'rish: `/reyting?snapshot=2026-W33`.

**Muhim tartib:** kesim musobaqa **boshlanishidan oldin** olinadi. Musobaqadan
keyin olinsa, taqqoslash uchun baza qolmaydi va jadvalda hech qanday ▲▼
ko'rinmaydi (hammasi "—" bo'ladi). O'tkazib yuborilgan bo'lsa, kesimni ballar
jurnalidan tiklash mumkin:

```bash
pnpm --filter @uztt/api exec ts-node --transpile-only   scripts/pre-tournament-snapshot.ts <turnir-slug>
```

O'rin qo'yish qoidasi — sport standarti: teng ball → teng o'rin, keyingisi
raqamni o'tkazib yuboradi (1-2-2-4). Jonli jadval ham, kesim ham bir xil
qoidadan foydalanadi.

## Ishlash (performance) yechimlari

Sayt musobaqa kunida ham silliq ishlashi uchun qilingan asosiy narsalar:

**Frontend**
- Shriftlar variable ko'rinishda (bitta faylda barcha qalinliklar), kirill subseti faqat `/ru` sahifalarida yuklanadi.
- `socket.io-client` dinamik import — jonli hisob kerak bo'lmagan sahifalar uni umuman yuklamaydi.
- Bosh sahifadagi jonli lenta serverdan render qilinadi (LCP kutmaydi, kontent kechikib qo'shilmaydi).
- Sekin o'zgaruvchi bloklar (yangilik, video, homiy, musobaqa ro'yxati) Next Data Cache'da teg bilan saqlanadi va admin o'zgartirsa `/api/revalidate` orqali darhol yangilanadi.

**Backend**
- N+1 so'rovlar yo'q qilindi: o'yin g'olibi allaqachon yuklangan ishtirokchidan olinadi; hakam statistikasi va turnir ariza sonlari guruhlangan so'rovlarda.
- Indekslar: `matches(table_number, status)` (overlay/monitor har necha soniyada so'raydi), `match_events(actor_user_id, type)`, `tournament_registrations(tournament_category_id, status)`.
- O'yinchilar ro'yxati 500 tagacha cheklangan, viloyatlar alohida yengil endpointda.
- Kesh sarlavhalari: autentifikatsiyali javoblar `no-store`, kam o'zgaruvchi kontent `public, max-age` + `stale-while-revalidate`.

**Realtime**
- Aloqa uzilib qayta ulanganda mijoz o'yin xonalariga avtomatik qayta qo'shiladi (busiz overlay jimgina yangilanishdan to'xtardi).
- Server ikkala xonaga bitta emit bilan yuboradi — dublikat paket yo'q.

**Kuzatuv**
- `SLOW_REQUEST_MS` (default 500) — undan uzun HTTP so'rovlar logga tushadi.
- `SLOW_QUERY_MS` — kerak bo'lganda sekin SQL so'rovlarni ko'rsatadi (default o'chiq).

## Testlar

```bash
pnpm --filter @uztt/api test        # unit: scoring, draw, eligibility, crypto, env, ranking (68 ta)
pnpm --filter @uztt/api test:e2e    # API e2e: xavfsizlik regressiyasi + hakam ish oqimi
pnpm test:visual                    # Playwright vizual baseline (sayt ishlab turishi kerak)
pnpm audit:lighthouse               # mobil Lighthouse budjeti (perf ≥ 90)
k6 run tools/load/k6-live.js        # 20 stol yuklamasi (k6 o'rnatilgan bo'lsa)
```

E2E va vizual testlar ishlab turgan muhit talab qiladi (Postgres + seed, sayt).
Batafsil: `tools/audit/README.md`.

## To'liq musobaqa simulyatsiyasi

Platformani boshidan oxirigacha haqiqiy ish oqimida sinash uchun (o'yinchilar →
musobaqa → guruhlar → arizalar → qura → o'yinlar → yakunlash):

```bash
node tools/sim/tournament-sim.mjs
PER_GROUP=8 TOURNAMENT_YEAR=2026 node tools/sim/tournament-sim.mjs
```

Skript 5 ta yosh toifasi (U-13, U-15, U-17, U-19, kattalar) × 2 jins uchun
alohida guruh ochadi, har guruhga ishtirokchi yozadi, qura o'tkazadi va har
o'yinni hakam kodi bilan tasdiqlab, ochkolab yakuniga yetkazadi. Oxirida
chempionlar va reyting o'zgarishi chiqadi.

**DIQQAT:** bazaga real ma'lumot yozadi — faqat test/demo bazasida ishlating.
Ko'p so'rov yuborgani uchun `.env` da `THROTTLE_LIMIT` ni vaqtincha ko'taring.

## Legacy ma'lumotlarni ko'chirish

```bash
pnpm import:legacy                  # quruq yugurish — nima ko'chishini ko'rsatadi
pnpm import:legacy -- --apply       # haqiqiy import
```

Idempotent: qayta ishga tushirilsa dublikat yaratmaydi. Foydalanuvchilar
KO'CHIRILMAYDI (legacy bcrypt → bizda argon2id) — ular panelda qayta ochiladi;
hakam kodlari yangidan generatsiya qilinadi.

## Visual parity (WTT bilan solishtirish)

```bash
pnpm parity:capture-wtt     # WTT reference skrinshotlar (gitignored, faqat ichki)
pnpm parity:capture-local   # bizning sahifalar
pnpm parity:report          # tools/visual-parity/compare.html — yonma-yon ko'rish
```

WTT'ning logotipi, rasmlari va kontenti loyihaga kiritilmaydi — skrinshotlar faqat
layout o'lchovlarini (shrift, balandlik, padding) qayta qurish uchun ichki reference.

## Deploy tartibi (MUHIM)

API konteyneri ishga tushganda migratsiyalarni **o'zi** qo'llaydi
(`docker-entrypoint.sh` → `prisma migrate deploy` → seed → server). Shuning
uchun to'g'ri tartib faqat shu:

```bash
docker compose build api web     # 1. yangi image
docker compose up -d             # 2. konteyner ko'tariladi va migratsiyani o'zi qo'llaydi
```

**Hostdan `prisma migrate deploy` ishlatmang** — agar migratsiya bazani
o'zgartirsa-yu, konteynerdagi API eski kod bilan ishlab tursa, u yangi
qiymatlarni tanimay 500 qaytaradi (masalan `Value 'WIN' not found in enum`)
va sayt bo'limi bo'sh ko'rinadi. Bazani kodidan oldinga o'tkazib yubormang.

Tekshirish:

```bash
docker compose ps                       # hammasi (healthy)
curl -s -o /dev/null -w '%{http_code}
' http://localhost:4000/api/levels
docker compose logs api --tail=30       # migratsiya va seed loglari
```

## Serverga deploy (production)

```bash
cp .env.example .env        # sirlar + WEB_ORIGIN/NEXT_PUBLIC_API_URL = https://domen.uz
# TLS: deploy/certs/ ichiga fullchain.pem + privkey.pem (certbot)
docker compose -f docker-compose.prod.yml up -d --build
```

Prod stack: postgres (tashqi portsiz) + api + web + **nginx** (TLS, HSTS, gzip, WebSocket)
+ **kunlik shifrlangan backup** (aes-256, 14 kun saqlanadi, `backups/` papkada).

Konteynerlarda healthcheck bor: web faqat api sog'lom bo'lgandan keyin ishga
tushadi, `docker compose ps` esa haqiqiy holatni ko'rsatadi:

```bash
docker compose ps                    # STATUS ustunida (healthy) bo'lishi kerak
docker compose logs api --tail=50    # sekin so'rovlar SLOW_REQUEST_MS bilan ko'rinadi
```

## Hujjatlar

- To'liq reja: `C:\Users\User\.claude\plans\` (Phase 0-5)
- Eski MVP hujjati: `legacy/README.md`
