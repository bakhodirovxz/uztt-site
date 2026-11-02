# Xavfsizlik — nima qilingan va qanday tekshiriladi

## Yangi oqimlar (v7)
| Oqim | Himoya | Test |
|---|---|---|
| Hakam / murabbiy bo'lib ro'yxatdan o'tish (`POST /api/applications/referee`, `/coach`) | Ommaviy, lekin **rol berilmaydi**: foydalanuvchi rolsiz, profil `PENDING`. Rolni faqat `applicant.review` huquqi bor administrator beradi. IP bo'yicha soatiga 5 ta ariza. DTO: `whitelist + forbidNonWhitelisted` (masalan `roles` yuborilsa 400), parol ≥ 10 belgi (argon2id), email/telefon formati tekshiriladi | `applications.e2e-spec.ts` |
| Arizani ko'rib chiqish | Faqat `applicant.review`. Faqat `PENDING` ko'riladi (qayta ko'rib bo'lmaydi → 409). Rad etish sababi majburiy | e2e |
| Klub ochish (`POST /api/clubs/request`) | Faqat tasdiqlangan murabbiy (`coach.players.manage`), soatiga cheklov, bir vaqtda ≤ 3 kutilayotgan so'rov, nom unikal. Tasdiqlanmaguncha ommaviy ro'yxatda **ko'rinmaydi** | e2e |
| O'yinchi rasmi yuklash (`POST /api/players/:id/photo`) | Kim: `player.manage`, o'yinchining o'zi yoki uning tasdiqlangan murabbiyi. Mijoz yuborgan mime ishonilmaydi — `sharp` haqiqiy formatni aniqlaydi (faqat JPEG/PNG/WebP), SVG/PHP/boshqa rad etiladi; ≤ 5 MB, ≤ 40 Mpx, ≥ 200×200; rasm **qayta kodlanadi** (EXIF va yashirin ma'lumot tushib qoladi); fayl nomini server yaratadi (yo'l hujumi yo'q); soatiga 20 ta | e2e |
| Hakamni avtomatik tayinlash | Tayinlash/almashtirish faqat `referee.assign`. Qat'iy qoidalar: ishtirokchi o'z o'yinida hakam bo'la olmaydi (4.6.1.1), tasdiqlanmagan/band hakam tayinlanmaydi, bir vaqtda ikki o'yinda emas. O'yin kodini **faqat tayinlangan** yetakchi/yordamchi hakam (yoki `match.manage`) kirita oladi | e2e + 11 unit |
| Ommaviy o'yin ma'lumoti | Hakam haqida faqat **ism**; id/email chiqmaydi | e2e |

## v11: hisoblar va parollar
- **Boshlang'ich parollar tasodifiy** (12 belgi, 0/O/1/l kabi chalkash belgilarsiz) va faqat argon2id hash ko'rinishida saqlanadi. Demo hisoblar (`admin123`, `hakam123`… ) real bazada YO'Q.
- **Majburiy almashtirish:** `users.must_change_password = true` bo'lgan foydalanuvchi kirgach faqat `/auth/me` va `/auth/change-password` ni ishlata oladi, qolgan himoyalangan endpointlar `403 PASSWORD_CHANGE_REQUIRED` qaytaradi; sayt uni `/account` ga yo'naltiradi.
- **Parol almashtirish** (`POST /auth/change-password`): joriy parol tekshiriladi, yangi ≥ 10 belgi va joriyidan farqli, boshqa barcha sessiyalar (refresh tokenlar) bekor qilinadi, 15 daqiqada 10 urinish.
- **Rollar matritsasi testi:** 9 rol × 26 himoyalangan endpoint (`roles-matrix.e2e-spec.ts`): ruxsati yo'q rol aniq 403 oladi, ruxsati bor rol esa 401/403 olmaydi.
- **Akkaunt bloklash:** ketma-ket 8 ta xato parol → hisob 15 daqiqaga bloklanadi (IP bo'yicha throttling'dan tashqari, parol terishdan himoya). Xabar mavjud/mavjud emas email uchun bir xil; to'g'ri parol ham blok paytida o'tmaydi. Administrator parolni tiklasa blok ochiladi.
- **Parol siyosati** (`common/password-policy.ts`): oddiy foydalanuvchi ≥10 belgi + katta/kichik harf + raqam; boshqaruvchi (PLAYER dan boshqa har qanday rol) ≥14 belgi + maxsus belgi; oddiy parollar ("password", "uztt"…), email/ism qismi bor parollar rad etiladi. Ro'yxatdan o'tish, ariza, parol almashtirish va administrator tiklashi — hammasida.
- **Administrator parol tiklashi** vaqtinchalik: foydalanuvchi birinchi kirishda o'zi almashtiradi; panelda "Kuchli parol yaratish" tugmasi (brauzer kriptografiyasi).
- **Root (admin@uztt.uz) boshlang'ich paroli** 28 belgi tasodifiy (harf, raqam, maxsus belgi); birinchi kirishda almashtirish majburiy.
- **Telegram:** token faqat serverda; xabarlarda hech qachon chiqmaydi; ichki (ariza) xabarlar alohida `TELEGRAM_ADMIN_CHAT_ID` ga, shaxsiy ma'lumotsiz (email/telefon/parol yo'q).
- `/auth/session` — ommaviy, faqat `{authenticated: true|false}` qaytaradi (shaxsiy ma'lumotsiz).

## Umumiy (oldingi tekshiruvlar, hammasi testda)
- Parollar argon2id; access token httpOnly cookie, `sameSite=lax`, productionda `secure`; CSRF guard (Origin allowlist); refresh token oilasi (o'g'irlansa butun oila bekor).
- Helmet, `trust proxy=1` (nginx orqasida to'g'ri IP — throttling IP bo'yicha), global throttler + muhim endpointlarda qat'iy `@Throttle`.
- DTO validatsiya hamma joyda; UUID parametrlar `ParseUUIDPipe`.
- `uploads/private` hech qachon serve qilinmaydi; hakam kodi faqat hash ko'rinishida, 5 xato urinishdan keyin bloklanadi.
- Permission'lar migratsiya orqali beriladi (production'da seed ishlamaydi): `applicant.review`, `referee.assign`, `club.manage`.

## Bog'liqliklar (pnpm audit)
Audit topgan edi: **Next.js 16.2.12 — 6 ta critical (RCE)**, `proxy-addr` (IP soxtalashtirish → throttling aylanib o'tiladi), `multer`, `qs`, `body-parser`, `engine.io`, `sharp` (yuklangan rasmlarni qayta ishlaydi).
Yangilandi: `next 16.4.3`, `sharp ^0.35.5`, `multer ^2.5.0` + `pnpm-workspace.yaml` dagi `overrides` (tranzitiv paketlar). Natija: `pnpm audit --prod` → **0 ta zaiflik**. Qolganlari faqat dev-bog'liqliklar (serverga tushmaydi).
Tekshiruv: `pnpm audit --prod` — har deploydan oldin ishga tushiring.

## Tavsiya (hali qilinmagan)
- Root va administratorlar uchun ikki bosqichli kirish (TOTP, Google Authenticator) — eng kuchli qo'shimcha himoya; talab bo'lsa alohida qo'shiladi.
- Email tasdiqlash va "parolni unutdim" havolasi (o'yinchilarda haqiqiy pochta yo'q, shuning uchun hozir parolni administrator tiklaydi).

## Ma'lum kelishuvlar (qaror sizniki)
1. Ro'yxatdan o'tishda takroriy email `409` qaytaradi — bu email mavjudligini oshkor qiladi (ariza formasida qulaylik uchun). Qat'iyroq variant: har doim "ariza qabul qilindi" deyish.
2. Email tasdiqlash (havola yuborish) hali yo'q — soxta email bilan ariza berish mumkin, lekin admin tasdiqlamaguncha hech narsa ocha olmaydi.
3. Rasmlarni virus-skanerlash yo'q; qayta kodlash zararli yuklarni yo'q qiladi.
4. CAPTCHA yo'q; himoya — IP throttling + admin tasdig'i.

## Deploydan oldingi ro'yxat
- [ ] `pnpm install --frozen-lockfile` (yangi lockfile) → `pnpm audit --prod`
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY` — noyob, ≥ 32 belgi; `.env` gitda yo'q
- [ ] `WEB_ORIGIN` — faqat o'z domeningiz
- [ ] Postgres tashqaridan yopiq; nginx 80/443 dan boshqa port ochiq emas
- [ ] Migratsiya qo'llangandan so'ng admin hisobida 3 ta yangi permission borligi: `SELECT code FROM permissions WHERE code IN ('applicant.review','referee.assign','club.manage');`
