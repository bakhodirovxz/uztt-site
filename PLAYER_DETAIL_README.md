# O'yinchi profili sahifasi — uttf.uz'ga mos qilib qayta ishlandi

## Tekshirdim: aralash juftlik / juftlik / jamoaviy ma'lumotlari

uttf.uz'ga jonli kirib uchala bo'limning joriy umumiy sonini solishtirdim:

| Bo'lim          | uttf.uz (hozir) | Bizning bazamiz |
|-----------------|-----------------|------------------|
| Juftlik         | 379             | 379              |
| Aralash juftlik | 409             | 409              |
| Jamoaviy        | 369             | 369              |

**Uchtasi ham aniq mos keladi** — bu ma'lumot avvalroq to'liq ko'chirilgan va
sizning bazangizda allaqachon bor (agar `uttf-rankings-import-data.sql`ni
ishga tushirgan bo'lsangiz). Qayta ko'chirishning hojati yo'q. Agar saytingizda
"Reyting" bo'limida shu uch tab bo'sh chiqsa — demak o'sha SQL fayl hali
ishga tushirilmagan, uni oldingi xabarimdan topib ishga tushiring.

## O'yinchi profili (bosganda chiqadigan sahifa)

uttf.uz'ning "Sportchi" sahifasini browser orqali ochib, uning ichki API'sini
(`/api/table-tennis/sportsman/index`) tekshirdim va dizaynni **aynan** shu
tuzilishga moslab qayta qurdim:

- Tepada "‹ Orqaga | O'yinchilar" va "Ma'lumotlar / Musobaqalar / Ballar
  tarixi" bo'lim havolalari
- Chapda: katta rasm (yoki bo'lmasa — ismi bosh harflari), ism, yosh toifasi
  belgisi
- Rasm tagida statistika qatori: **Yoshi / Reyting / Ballar / ID raqami**
  (aynan uttf.uz'dagi kabi)
- O'ngda ikkita karta: **Hudud** va **Sport maktabi/klubi** (klub nomi +
  uning hududi/tumani — bu ma'lumot allaqachon bazangizda bor edi, endi
  chiqariladi)

**Kod fayllari** (ustidan almashtiring):
- `players.service.ts` → `apps/api/src/modules/players/players.service.ts`
- `player-detail-page.tsx` → `apps/web/src/app/(site)/[locale]/players/[slug]/page.tsx`
- `uz.json`, `en.json`, `ru.json` → `apps/web/src/messages/`

Bazaga o'zgartirish/migratsiya kerak emas — mavjud maydonlar (klub hududi,
ID raqami) allaqachon bor edi, faqat frontendga chiqarilmagan edi.
`pnpm dev`ni qayta ishga tushirgach darhol ko'rinadi.

## Ataylab qo'shmagan ikkita narsa

1. **"❤ 148" (yoqtirganlar soni)** — bu uttf.uz'da foydalanuvchilar
   sportchini "like" bosishi natijasida hosil bo'ladigan jonli hisoblagich.
   Bizning saytda bunday funksiya umuman yo'q, shuning uchun soxta raqam
   ko'rsatishning o'rniga umuman qo'ymadim. Agar xohlasangiz, buni alohida
   funksiya sifatida qo'shib beraman (bazaga yangi jadval kerak bo'ladi).

2. **"Pasportni yuklab olish" (pasport hujjatini yuklab olish havolasi)** —
   buni ataylab qo'shmadim. Sportchining pasport skanini ochiq (autentifikatsiyasiz)
   yuklab olinadigan qilib qo'yish — hatto uttf.uz shunday qilsa ham — shaxsiy
   hujjat xavfsizligi nuqtai nazaridan xavfli amaliyot. Bizning tizimda
   hujjatlar (`PlayerDocument`) allaqachon kirish nazorati va jurnal
   (`DocumentAccessLog`) bilan himoyalangan — buni ochiq qilib qo'yish o'sha
   himoyani buzadi. Agar kerak bo'lsa, buni faqat administrator panelida
   (login qilingandan keyin) ko'rsatish mumkin — aytsangiz, shuni qilib beraman.
