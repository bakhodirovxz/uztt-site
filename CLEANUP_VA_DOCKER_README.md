# Demo o'yinchilarni o'chirish + saytni doimiy yangilangan holatda ochish

## 1) Demo (namunaviy) o'yinchilarni o'chirish

`cleanup-seed-players.sql` — men avvalroq yaratgan 12 ta demo o'yinchi
(Aziz Rahimov, Botir Qodirov, Gulnora Tosheva, Hulkar Mirzayeva va h.k. —
`UZ-1001`...`UZ-1012`) va 1 ta test o'yinchisini (`UZ-9001`), shuningdek ular
qatnashgan demo turnirni (`respublika-chempionati-2026`) o'chiradi.

**uttf.uz'dan import qilingan 5520+ haqiqiy o'yinchiga tegmaydi** — ularning
ID raqami har doim uttf.uz'dagi haqiqiy PINFL qatori, hech qachon `UZ-` bilan
boshlanmaydi. Skript buni o'zi ham tekshiradi: agar biror sababdan haqiqiy
o'yinchilar sonida o'zgarish sezsa, avtomatik ravishda hech narsa saqlamay
orqaga qaytadi (ROLLBACK) va xato chiqaradi — xavfsizlik uchun ikki marta
tekshiruv qo'yilgan.

Mahalliy test bazasida to'liq tekshirib ko'rdim: demo turnir va demo
o'yinchilarni test sifatida qo'shib, skriptni ishga tushirdim — aynan 13 ta
demo yozuv o'chdi, 5520 ta haqiqiy o'yinchi tegilmay qoldi. Ikkinchi marta
ishga tushirsangiz ham xavfsiz (hech narsa yo'q bo'lsa, shunchaki "0 ta
o'chirildi" deb yozadi, xato bermaydi).

**Ishga tushirish** (loyihaning `apps/api` papkasidan, `.env` fayli
o'qilgandan keyin — avvalgi `uttf-news-i18n.sql`ni ishga tushirgandagi kabi):

```
cd apps/api
psql "$env:DATABASE_URL" -f ..\..\cleanup-seed-players.sql
```

(PowerShell'da `$env:DATABASE_URL`, agar oddiy `cmd`da bo'lsangiz avval
`.env`dagi `DATABASE_URL=...` qatorini ko'rib, uni to'g'ridan-to'g'ri
`psql "postgresql://..." -f cleanup-seed-players.sql` shaklida yozing.)

Ishlagach ekranda shunga o'xshash xabar chiqadi:

```
NOTICE:  Boshlanishidan oldin: haqiqiy o'yinchilar = 5520, demo (UZ-%) o'yinchilar = 13
NOTICE:  O'chirildi: demo turnir = 1 ta, demo o'yinchi = 13 ta
NOTICE:  Tugagandan keyin: haqiqiy o'yinchilar = 5520 (o'zgarmasligi kerak)
COMMIT
```

**OGOHLANTIRISH:** bu skriptni ishga tushirgach, bosh sahifadagi **"JONLI"
(live) chiziqcha** va **"Respublika chempionati boshlandi" banneri** bo'sh
bo'lib qoladi — chunki ular butunlay shu demo turnir va demo o'yinchilar
ustida qurilgan edi. Bu kutilgan holat. Haqiqiy musobaqa (tournament)
ma'lumotlarini uttf.uz'dan olib import qilish — bu keyingi bosqichdagi ish
(avval aytganingizdek, rasm/yosh va yangiliklar birinchi navbatda edi, ular
tugadi; musobaqalar navbatda).

## 2) Saytni doimiy yangilangan ko'rinishda ochish (har safar `pnpm dev`
   yozmasdan)

Hozir ikkita alohida "sayt" bor edi:

- **`pnpm dev` (port 3000)** — jonli development server, fayllarga qilingan
  har bir o'zgartirish darhol ko'rinadi, lekin kompyuterni yopsangiz yoki
  terminalni yopsangiz o'chib qoladi.
- **Docker (`localhost:3100`)** — doimiy ishlab turadigan versiya, lekin bu
  **tayyor qurilgan (build qilingan) nusxa** — men fayllarga qancha
  o'zgartirish kiritsam ham, siz uni qayta build qilmaguningizcha eskicha
  qolaveradi. Aynan shuning uchun "eski dizayn" chiqib turgan edi.

**Yechim**: Docker'dagi versiyani qayta build qilib, uni doimiy fon
rejimida (background) ishlab turadigan qilib qo'yamiz. Shundan keyin
kompyuterni yoki terminalni yopsangiz ham `localhost:3100` doimiy ishlab
turadi va istalgan vaqt eng oxirgi holatda ochiladi — `pnpm dev` yozishning
hojati qolmaydi.

Loyihaning bosh papkasida (`C:\Users\User\Desktop\uztt-site`) shuni ishga
tushiring:

```
docker compose up -d --build
```

Bu birinchi safar bir necha daqiqa vaqt olishi mumkin (barcha kod qayta
build bo'ladi). Tugagach `localhost:3100`ni ochsangiz — eng yangi dizayn
(rasm/yosh, sahifalash, yangi o'yinchi profili) doimiy ko'rinadi, hatto
kompyuterni qayta yoqsangiz ham (Docker Desktop avtomatik ishga tushsa).

**Muhim eslatma keyingi safarlar uchun**: men bundan keyin ham kod
o'zgartirishlar yuborsam, ular avtomatik ravishda `localhost:3100`ga
ko'chib o'tmaydi — chunki bu **build qilingan** nusxa. Har safar yangi
o'zgartirish qo'llagandan so'ng, `localhost:3100`ni yangilash uchun yana
shu buyruqni ishga tushirishingiz kerak bo'ladi:

```
docker compose up -d --build
```

Agar tezroq, jonli tekshirish kerak bo'lsa (masalan, men o'zgartirish
yuborganimda darhol ko'rish uchun), `pnpm dev` (port 3000) hamon eng tez
yo'l bo'lib qoladi — u har doim darhol yangilanadi, build kutish shart emas.
