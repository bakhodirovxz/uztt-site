# UZTT platformasi — Claude Code uchun ko'rsatma

Bu loyiha **jonli ishlaydi**: https://stoltennis.uz. Har bir o'zgarish real
foydalanuvchilarga va ~5 600 sportchining ma'lumotiga tegadi.

---

## 0. Har bir o'zgarishdan keyin — ish tartibi

Bu papka (`C:\Users\User\Desktop\uztt-site`) — git repo, `origin` =
https://github.com/bakhodirovxz/uztt-site, ish branchi `main`.

**Har bir tugallangan o'zgarishni, muammo bo'lmasa, GitHub'ga push qil va
serverga chiqar.** Ketma-ketlik:

```
1. Tekshir     tsc (api+web), jest, i18n parity        → xato: TO'XTA, tuzat
2. Maxfiylik   staged fayllarda PII/sir yo'qligi (§3)  → bor: TO'XTA
3. Commit      ma'noli xabar bilan (o'zbekcha)
4. Push        git push origin main  → GitHub Actions deployni boshlaydi
5. Kuzat       Actions natijasi; secretlar yo'q yoki nginx/.env o'zgargan
               bo'lsa — DEPLOY.local.md §3 bo'yicha qo'lda deploy
6. Tasdiqla    prod'da tekshiruvlar (§2 pastki qismi + DEPLOY.local.md §4)
```

To'xtash shartlari — **push ham, deploy ham qilinmaydi**:
tekshiruv yiqilgan; PII/sir staged; migratsiya mavjud ma'lumotni
o'zgartiradi va prod nusxasida sinalmagan (pastga qara); musobaqa kuni.

### Serverga ulanish — kalit qayerda

| | |
|---|---|
| Kalit | `~/.ssh/id_uztt_deploy` (Windows: `C:\Users\User\.ssh\id_uztt_deploy`) |
| Server, foydalanuvchi, yo'llar, buyruqlar | **`DEPLOY.local.md`** — avval shuni o'qi |

`DEPLOY.local.md` `.gitignore` da (repo ochiq) — u faqat shu kompyuterda.
Parol bilan SSH ishlamaydi, faqat kalit. Serverda fail2ban bor: ulanish
yiqilsa, ketma-ket qayta urinma — sababini aniqla.

### Migratsiya bo'lsa — avval prod nusxasida sina

Jonli bazaga qo'llashdan oldin migratsiyani serverdagi **nusxa bazada**
ishga tushir (`uztt_migtest`: `pg_dump uztt | psql uztt_migtest`, keyin
`prisma migrate deploy` shu bazaga). Natijani SQL bilan tekshir. Jonli
baza (`uztt`) ga faqat `api` konteyneri ishga tushganda o'zi qo'llaydi.
Allaqachon qo'llangan migratsiya faylini **hech qachon o'zgartirma** —
tuzatish uchun yangi migratsiya qo'sh.

---

## 1. Deploy — avtomatik

**`main` ga push qilsang, GitHub Actions o'zi deploy qiladi:**
`.github/workflows/deploy.yml`. (Secretlar sozlanmagan bo'lsa faqat
tekshiradi — unda `DEPLOY.local.md` §3 bo'yicha qo'lda.)

```
tekshir → musobaqa kunimi? → zaxira → yukla → image → deploy → tasdiqla
```

Har bosqich oldingisiga bog'langan: biri yiqilsa keyingisi **umuman
ishlamaydi**. Ish oqimi o'zgargan fayllarga qarab hal qiladi — faqat
`apps/web` tegilgan bo'lsa faqat `web` qayta quriladi (ikki baravar tez).

Shuning uchun sening vazifang oddiy:

```
1. Tiplarni tekshir  → to'xtash: xato bo'lsa
2. Maxfiy fayl tekshiruvi → to'xtash: staged bo'lsa
3. Commit + push
4. Actions natijasini kuzat
```

**Musobaqa kuni qo'riqchisi.** Deploy paytida `web` konteyneri qayta
ko'tariladi, ya'ni `/screen` (zal ekrani) va `/overlay` (OBS) bir necha
soniya uziladi. Muddati (`endDate`) hali tugamagan LIVE musobaqa bo'lsa
ish oqimi **to'xtaydi**. Chetlab o'tish: Actions → Deploy → Run
workflow → `force`.

**Workflow nginx'ni o'rnatmaydi.** `deploy/stoltennis.uz.nginx.conf`
o'zgarsa — `DEPLOY.local.md` §3 "nginx o'zgargan bo'lsa".

Deploydan oldin baza avtomatik zaxiralanadi:
`/opt/uztt/_data/pre-deploy-<sana>.sql.gz` (7 kun saqlanadi).

### Kerakli GitHub secretlar

`Settings → Secrets and variables → Actions`:

| Nom | Nima |
|---|---|
| `SSH_PRIVATE_KEY` | deploy kaliti (to'liq matn, `-----BEGIN` dan `-----END` gacha) |
| `SSH_HOST` | server IP |
| `SSH_USER` | `root` |
| `SITE_URL` | `https://stoltennis.uz` |

Qiymatlar `DEPLOY.local.md` da (u `.gitignore` da).

### Qo'lda deploy

Actions ishlamasa yoki serverga to'g'ridan-to'g'ri kirish kerak bo'lsa —
to'liq buyruqlar **`DEPLOY.local.md`** da.

### Qachon deploy QILMASLIK kerak

- **Musobaqa kuni** — qo'riqchi buni o'zi tutadi, lekin `force` bilan
  chetlab o'tishdan oldin ikki marta o'yla.
- Tekshiruvlardan biri yiqilgan bo'lsa — `force` bilan majburlama.

---

## 2. Deploydan oldin majburiy tekshiruvlar

```bash
# Tiplar va testlar
cd apps/api && npx tsc --noEmit -p tsconfig.json && npx jest
cd apps/web && npx tsc --noEmit -p tsconfig.json

# i18n drift (build oldidan avtomat ham ishlaydi)
cd apps/web && node scripts/check-i18n-parity.mjs
```

Deploydan **keyin**, prodga qarshi — saytga yuklab nimalarni tekshirish:

```bash
# 1. Sayt va API tirikmi
curl -s -o /dev/null -w "%{http_code}\n" https://stoltennis.uz/   # 200
curl -s https://stoltennis.uz/api/health

# 2. Shaxsiy ma'lumot sizmayapti — ikkalasi 0 bo'lishi SHART
curl -s 'https://stoltennis.uz/api/players?pageSize=500' | grep -c birthDate
curl -s 'https://stoltennis.uz/api/players?pageSize=500' | grep -c licenseNumber

# 3. Brauzerda: 28 marshrut x 3 til + efir grafikasi rangi o'zgarmagan
cd tools/visual-parity
node functional-check.mjs https://stoltennis.uz
node broadcast-check.mjs verify https://stoltennis.uz
```

`functional-check` da yagona kutilgan "muammo" — 404 sahifasi (u to'g'ri
404 qaytargani uchun brauzer konsolga yozadi). Boshqasi yiqilsa — muammo.
Konteyner holati va migratsiyalar: `DEPLOY.local.md` §4.

Biror tekshiruv yiqilsa: sababini aniqla; tuzatib bo'lmasa — oldingi
commitga qaytar (`git revert`) va qayta push, migratsiya bo'lsa bazani
`pre-deploy-*.sql.gz` dan tikla (`DEPLOY.local.md` §5).

---

## 3. Hech qachon gitga tushmasligi kerak

Repo **OCHIQ**: https://github.com/bakhodirovxz/uztt-site

`.gitignore` da ataylab chiqarilganlar — **olib tashlama**:

| Fayl | Nima bor |
|---|---|
| `uttf-full-export.json`, `uttf-*-import-data.sql` | 5 520 sportchining **PINFL** (milliy ID), ismi, yoshi, tumani |
| `apps/web/public/uttf-import/` | 2 105 fotosurat, 450 MB — asosan **bolalar** |
| `_backup/`, `*.sql.gz` | baza zaxiralari |
| `.env` | JWT, baza paroli, AES shifrlash kaliti |
| `DEPLOY.local.md` | server IP, SSH kaliti, yo'llar |
| `local/` (`pgdata/`, `.sbsecret`) | lokal PostgreSQL bazasining to'liq nusxasi, scoreboard siri |
| `demo-data/` | baza dampi (`real.json` — real odamlar) |
| `apps/scoreboard/players-db.json`, `telegram.json` | 5k o'yinchi ismi/yoshi/hududi; bot tokeni |
| `*.zip`, `*.xlsx`, `akkauntlar*.csv`, `*parollar*` | yangilanish arxivlari, hisob parollari |

Bu ma'lumotlarning **3 425 tasi 18 yoshgacha** bolalarga tegishli.

Commitdan oldin har doim:

```bash
git diff --cached --name-only | grep -iE '^\.env$|uttf-import/|uttf-full-export|_backup/|DEPLOY\.local|^local/|demo-data/|players-db\.json|telegram\.json|\.zip$|\.xlsx$|akkaunt|parol'
```

Natija bo'sh bo'lishi shart.

---

## 4. Loyihaning o'ziga xosliklari (tuzoqlar)

### Dizayn tokenlari
- Yagona haqiqiy stylesheet: `apps/web/src/styles/globals.css`.
  `apps/web/src/app/globals.css` — **o'lik**, hech kim import qilmaydi.
- Tailwind v4 CSS-first. `@theme` dagi qiymatni o'zgartirsang, butun sayt
  o'zgaradi — **token NOMLARINI o'zgartirma**, ~40 fayl ishlatadi.
- Ranglar worldtabletennis.com dan **o'lchab** olingan
  (`tools/visual-parity/extract-design.mjs`), taxmin emas.

### Efir sahifalari — alohida tokenlar
`/screen` va `/overlay` **faqat** `--color-broadcast-*` tokenlarini
ishlatadi. Ularga umumiy token (`navy-*`, `accent-*`) qo'yma: sayt
redizayni jonli efir grafikasini bilintirmay qayta bo'yab yuboradi.
`broadcast-check.mjs` aynan shuni tutadi.

### `body {}` qoidasi Tailwind'dan ustun
`globals.css` dagi `body { background: ... }` layer'dan tashqarida, ya'ni
`bg-*` utilitasi **ishlamaydi**. Shuning uchun `/screen` `data-screen`
atributidan foydalanadi. Yangi root layout qo'shsang, shuni yodda tut.

### i18n
- Uchala til fayli bir xil kalitlar bilan turishi shart
  (`check-i18n-parity.mjs` build oldidan bloklaydi).
- Yo'llar tarjima qilingan: `/news` → `/yangiliklar`, `/players` →
  `/oyinchilar`. `src/i18n/routing.ts` ga qara.
- `Link` ni **`@/i18n/navigation`** dan import qil, `next/link` dan emas.

### uttf.uz sinxronizatsiyasi
- `apps/api/src/modules/uttf-sync/` — `dryRun` **default `true`**.
  Avval farqni ko'r, keyin `dryRun: false`.
- Endpointlar taxmin qilinmagan, tutib olingan:
  `tools/uttf-discover/uttf-endpoints.json`.
- **Tuzoq:** uttf'dagi `nameUz` KIRILL alifbosida. Lotincha nom
  `tournaments/index` ning `name` maydonida.
- **Tuzoq:** `tournament-grouping/is-grouped` faqat `true/false` bayroq,
  ma'lumot emas. Ma'lumot `match/get-group-matches` da.

### Ma'lumot maxfiyligi
- `PUBLIC_PLAYER_SELECT` ga `birthDate`, `licenseNumber`, `districtName`,
  telefon yoki manzil **qo'shma**. Bu ommaviy, autentifikatsiyasiz endpoint.
  `licenseNumber` ustunida ba'zi o'yinchilarning HAQIQIY PINFL (milliy ID)
  raqami turadi. Yosh kerak bo'lsa — faqat hisoblangan `age`.
- Slug'ni hech qachon PINFL raqamlaridan yasama.
- Yangi ommaviy endpoint yozsang, `PUBLIC_*_SELECT` naqshini ishlat va
  nima chiqayotganini aniq ko'rsat.

### Hududlar
- Yagona o'zbekcha shakl: `apps/api/src/common/regions.ts` →
  `normalizeRegion()`. Hududni bazaga yozadigan HAR bir joy (sync,
  ro'yxatdan o'tish, import) shu funksiyadan o'tkazsin.
- Apostrof turlari (`'` `‘` `’` `ʻ` `ʼ`) `regionKey()` da birlashtiriladi —
  aks holda "Farg‘ona" va "Farg'ona" ikki hudud bo'lib qoladi.

### Reyting rejimi
- `tournament_levels.rating_mode`: `OFFICIAL` (Nizom formulasi, K
  koeffitsiyenti) yoki `LEGACY` (admin sozlagan ball qoidalari). 2026-11
  dan barcha darajalar OFFICIAL. Batafsil: `QOIDALAR.md`.

### Zal scoreboard'i (`apps/scoreboard`)
- Alohida Node jarayoni (planshet/TV/OBS). Prod'da `scoreboard` konteyneri,
  port tashqariga ochilmaydi. Sayt bilan `/api/sb/*` orqali `SB_SECRET`
  bilan bog'lanadi.
- `apps/web/src/proxy.ts` uning yo'llarini (`/control`, `/tv`, ...) ruxsatni
  tekshirib `SB_ORIGIN` ga yo'naltiradi. Host nginx `/api/*` ni NestJS'ga
  yuboradi, shuning uchun `SB_EXACT` dagi `/api` yo'llari nginx konfigida
  alohida yozilgan — ro'yxat o'zgarsa, ikkalasini ham yangila.
- Ma'lumot serverda `/opt/uztt/_data/scoreboard` da (gitda yo'q).
- **Tuzoq:** `players-db.json` dagi ba'zi `id` — haqiqiy PINFL, `uid` esa
  ommaviy JSON'ga chiqadi. Serverga faqat `scripts/sanitize-pdb.js` dan
  o'tkazib yukla; aks holda konteyner ishga tushmaydi (`SB_PUBLIC=1`).

### Prod seed
`prisma/seed.ts` production'da **ataylab ishlamaydi**. Kerak bo'lsa
`SEED_ALLOW_PROD=1` + `SEED_ADMIN_PASSWORD` + `SEED_ROOT_PASSWORD`.
Yangi permission qo'shsang, prodga **qo'lda** SQL bilan qo'shish kerak.

---

## 5. Arxitektura — qisqacha

```
Internet :443 (Let's Encrypt, certbot)
   ↓
HOST nginx  (/etc/nginx/sites-available/stoltennis.uz)
   ├─ /uttf-import/   → diskdan
   ├─ /api/ /socket.io/ /uploads/ → 127.0.0.1:4000
   └─ /                → 127.0.0.1:3000

Docker (uztt-prod): postgres, api, web, backup
  compose ichidagi nginx ISHLATILMAYDI (profiles: unused)
```

nginx **1.24** — `http2 on;` sintaksisi yo'q, `listen 443 ssl http2;`.

Konfig ikki joyda: `deploy/nginx.conf` (compose uchun) va
`deploy/stoltennis.uz.nginx.conf` (serverda ishlaydigani).
**Ikkalasini birga yangila.**

### `next.config.ts` — tegma
Faylda aniq ogohlantirish bor: `outputFileTracingRoot` / `turbopack.root`
o'rnatilsa standalone server `/` ni 307 siklida qoldiradi. `headers()`
qo'shish xavfsiz, boshqasiga tegma.

---

## 6. Foydali buyruqlar

```bash
# Lokal ishga tushirish (prod API ga qarshi)
cd apps/web && NEXT_PUBLIC_API_URL=https://stoltennis.uz \
  API_INTERNAL_URL=https://stoltennis.uz npx next start -p 3200

# WTT bilan dizayn farqi
cd tools/visual-parity
node extract-design.mjs local https://stoltennis.uz && node diff-design.mjs

# uttf.uz endpointlarini qayta kashf qilish
cd tools/uttf-discover && node discover.mjs
```

> **Eslatma:** 3100-port Docker konteyneriga tegishli (`wslrelay`).
> Lokal server uchun 3200 dan foydalan.
