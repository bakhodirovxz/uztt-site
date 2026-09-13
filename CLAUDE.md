# UZTT platformasi — Claude Code uchun ko'rsatma

Bu loyiha **jonli ishlaydi**: https://stoltennis.uz. Har bir o'zgarish real
foydalanuvchilarga va ~5 600 sportchining ma'lumotiga tegadi.

---

## 1. Deploy — avtomatik

**`main` ga push qilsang, boshqa hech narsa qilish shart emas.**
GitHub Actions o'zi deploy qiladi: `.github/workflows/deploy.yml`.

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
soniya uziladi. Jonli musobaqa bo'lsa ish oqimi **to'xtaydi**.
Chetlab o'tish: Actions → Deploy → Run workflow → `force`.

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
# Tiplar (ikkala ilova)
cd apps/api && npx tsc --noEmit -p tsconfig.json
cd apps/web && npx tsc --noEmit -p tsconfig.json

# i18n drift (build oldidan avtomat ham ishlaydi)
cd apps/web && node scripts/check-i18n-parity.mjs
```

Deploydan **keyin**, prodga qarshi:

```bash
cd tools/visual-parity
node functional-check.mjs https://stoltennis.uz   # 28 marshrut x 3 til
node broadcast-check.mjs verify https://stoltennis.uz   # efir grafikasi
```

`functional-check` da yagona kutilgan "muammo" — 404 sahifasi (u to'g'ri
404 qaytargani uchun brauzer konsolga yozadi). Boshqasi yiqilsa — muammo.

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

Bu ma'lumotlarning **3 425 tasi 18 yoshgacha** bolalarga tegishli.

Commitdan oldin har doim:

```bash
git diff --cached --name-only | grep -iE '^\.env$|uttf-import/|uttf-full-export|_backup/|DEPLOY\.local'
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
- `PUBLIC_PLAYER_SELECT` ga `birthDate`, `districtName`, telefon yoki
  manzil **qo'shma**. Bu ommaviy, autentifikatsiyasiz endpoint.
- Yangi ommaviy endpoint yozsang, `PUBLIC_*_SELECT` naqshini ishlat va
  nima chiqayotganini aniq ko'rsat.

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
