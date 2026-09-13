# Sifat tekshiruvlari

Uch xil tekshiruv — har biri ishlab turgan saytga qarshi bajariladi.

## 1. Vizual regressiya (Playwright)

Sahifa qiyofasi baseline bilan solishtiriladi. Jonli hisob va sanalar maskalanadi.

```bash
# Sayt ishlab turgan bo'lsin (Docker yoki pnpm dev:web)
pnpm --filter @uztt/web test:visual            # solishtirish
pnpm --filter @uztt/web test:visual:update     # baseline yangilash (dizayn ataylab o'zgarganda)
PLAYWRIGHT_BASE_URL=http://localhost:3100 pnpm --filter @uztt/web test:visual
```

Baseline fayllar `apps/web/e2e/visual/site.spec.ts-snapshots/` da saqlanadi va
repoga kiritiladi — ular bo'lmasa birinchi yugurish ularni yaratadi.

## 2. Lighthouse budjeti

Mobil profil, budjet: perf ≥ 90, a11y ≥ 95, best-practices ≥ 90, SEO ≥ 95.

```bash
node tools/audit/lighthouse.mjs
BASE_URL=http://localhost:3100 node tools/audit/lighthouse.mjs
```

Chrome topilmasa `CHROME_PATH` ni ko'rsating (Playwright chromium ham yaraydi:
`~/AppData/Local/ms-playwright/chromium-*/chrome-win64/chrome.exe`). Hisobotlar
`tools/audit/reports/` ga JSON ko'rinishida yoziladi (gitignored). Budjetdan past
ball — chiqish kodi 1.

**2026-08-11 dagi natija** (optimizatsiyadan keyin; lokal Docker stack, mobil
profil, 4× CPU sekinlashuvi va sekin 4G emulyatsiyasi):

| Sahifa | Perf | A11y | Best practices | SEO |
|---|---|---|---|---|
| Bosh sahifa | 85–88 | 100 | 96 | 100 |
| Yangiliklar | 90 | 100 | 96 | 100 |
| Reyting | 91 | 98 | 96 | 100 |
| Musobaqalar | 92 | 100 | 96 | 100 |

Yo'l: bosh sahifa 71 → 82 (jonli lenta serverdan render qilindi: TBT 355 → 49 ms,
CLS 0.107 → 0) → 85-88 (shrift hajmi 169 → 115 KB, socket.io alohida lazy chunkda).
Bosh sahifa budjetdan (90) biroz past qolmoqda: qolgan farq LCP'da (sahifada
bo'limlar ko'p) va o'lchov muhitiga sezilarli bog'liq — real serverda qayta
o'lchash kerak. Boshqa sahifalar budjetdan o'tdi.

Haqiqiy brauzerda (throttlingsiz, `tools/visual-parity/measure.mjs`):
LCP elementi — sarlavha matni, LCP 0.2–0.7 s, CLS 0.

**Diqqat:** agar brauzer `http://localhost:4000` ni ochgan bo'lsa va API HSTS
yuborsa, Chrome butun `localhost` ni HTTPS'ga majburlaydi va audit
`CHROME_INTERSTITIAL_ERROR` bilan yiqiladi. Shu sababli HSTS API'dan olib
tashlangan — uni faqat nginx beradi.

## 3. Tezkor o'lchov (LCP elementi, resurs hajmlari)

Lighthouse "LCP element" ni ba'zan ko'rsata olmaydi — bu skript uni brauzerdan
to'g'ridan-to'g'ri oladi va JS/shrift/rasm hajmlarini turlar bo'yicha sanaydi:

```bash
cd tools/visual-parity
node measure.mjs / /reyting /yangiliklar     # Git Bash'da: MSYS_NO_PATHCONV=1
```

## 4. Yuklama testi

k6 o'rnatilgan bo'lsa:

```bash
k6 run tools/load/k6-live.js
API_URL=http://localhost:4000 TABLES=20 k6 run tools/load/k6-live.js
```

k6siz (faqat Node kerak) — kechikish va row-lock to'g'riligini birga tekshiradi:

```bash
node tools/load/quick-load.mjs
PARALLEL=20 node tools/load/quick-load.mjs
```

**2026-08-11 dagi natija** (lokal Docker):

| O'lchov | Natija |
|---|---|
| Ketma-ket ochko (1 stol) | p50 13 ms · max 84 ms |
| Parallel (turli stollar) | p50 22 ms · p95 48 ms |
| Bitta o'yinga 20 parallel ochko | 20/20 qabul, seq aynan +20, hisob 10-10 — yo'qolgan yangilanish yo'q, jami 214 ms |
| Ommaviy endpointlar (live/reyting/turnirlar/o'yinchilar/qidiruv) | p50 3–4 ms |

Chegaralar: ochko kiritish p95 < 400 ms, xatolar ulushi < 1%.

**DIQQAT:** test real ochko yozadi — faqat test bazasida ishlating.

## 5. API e2e (supertest)

Ishlab turgan Postgres va bajarilgan seed talab qilinadi:

```bash
pnpm --filter @uztt/api test:e2e
```

Qamrov: xavfsizlik regressiyasi (sir sizishi, mass assignment, RBAC matritsasi,
maxfiy fayllar), hakam ish oqimi (5 urinishda blok → regeneratsiya → tasdiqlash →
ochko/undo → kartochka → diskvalifikatsiya) va ommaviy API smoke.

## 6. To'liq musobaqa simulyatsiyasi

Platformani boshidan oxirigacha sinaydi: o'yinchilar → musobaqa → guruhlar
(yosh toifasi × jins) → arizalar → qura → hakam kodi bilan o'ynash → yakunlash.

```bash
node tools/sim/tournament-sim.mjs
PER_GROUP=8 node tools/sim/tournament-sim.mjs
```

Ko'p so'rov yuboradi — `.env` da `THROTTLE_LIMIT` ni vaqtincha ko'taring.
Bazaga real ma'lumot yozadi, faqat test/demo bazasida ishlating.
