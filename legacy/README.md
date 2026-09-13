# O'zbekiston Stol Tennisi Federatsiyasi — MVP prototip

Bu ishlaydigan minimal prototip (MVP): ommaviy sayt, admin panel, hakam jonli ochko
kiritish interfeysi va OBS uchun translatsiya overlayi. To'liq texnik topshiriq
alohida Word hujjatida berilgan (TZ v1.2).

## MUHIM ESLATMA (soddalashtirishlar)

Bu tezkor prototip bo'lgani uchun ba'zi joylar soddalashtirilgan:

- **Ma'lumotlar bazasi**: PostgreSQL o'rniga oddiy JSON fayl (`backend/data/db.json`)
  ishlatilgan — kod tuzilishi bir xil, keyinchalik PostgreSQL'ga o'tkazish oson.
- **Autentifikatsiya**: asosiy JWT login ishlaydi, lekin 2FA, parolni tiklash kabi
  qo'shimcha funksiyalar yo'q.
- **Reyting hisoblash**: g'olibga bosqich+daraja asosida avtomatik ball beriladi
  (soddalashtirilgan formula), to'liq tarixiy reyting davri (12 oy va h.k.) yo'q.
- **.uz domen / geo-cheklash**: bu mahalliy prototip, domen va xosting sozlamalari
  kiritilmagan (TZ 7.3-bo'limga qarang).
- Vizual dizayn juda sodda — asosiy maqsad funksionallikni ko'rsatish.

## Ishga tushirish

Talab qilinadi: Node.js 18+.

### 1. Backend

```bash
cd backend
npm install
npm run seed     # namunaviy o'yinchilar, musobaqa, yangiliklar yaratadi
npm start         # http://localhost:4000 da ishga tushadi
```

Demo hisoblar (seed skripti chiqaradi):
- Bosh administrator: `admin@uztt.uz` / `admin123`
- Hakam: `hakam1@uztt.uz` / `hakam123`

### 2. Frontend

Ikki variant bor:

**A) Tayyor build orqali (eng oson)** — `frontend/dist` papkasi allaqachon tayyorlangan,
backend uni avtomatik xizmat qiladi. Backendni ishga tushirgach, brauzerda
`http://localhost:4000` manzilini oching — bo'ldi.

**B) O'zgartirish kiritmoqchi bo'lsangiz (dev rejimi)**:
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173 da ishga tushadi, backend'ga proxy qiladi
```
O'zgartirishlardan so'ng production uchun qayta yig'ish: `npm run build`.

## Jonli hakamlik va OBS overlayni sinab ko'rish

1. `http://localhost:4000/kirish` orqali hakam sifatida kiring (`hakam1@uztt.uz` / `hakam123`).
2. Yuqori menyudan "Hakam paneli" ga o'ting — seed orqali yaratilgan jonli o'yin ko'rinadi.
3. "Ochko kiritishni boshlash" tugmasini bosing va +1 tugmalari bilan ochko kiriting.
4. Boshqa brauzer oynasida `http://localhost:4000/musobaqalar` → tegishli musobaqani
   oching — hisob real vaqtda o'zgarishini ko'rasiz (sahifani yangilamasdan).
5. OBS uchun overlay: har bir o'yin sahifasida (Hakam panelida yoki Admin →
   Musobaqalar → boshqarish sahifasida) `/overlay/<token>` havolasi ko'rsatiladi.
   Shu havolani OBS'da "Brauzer manbai" (Browser Source) sifatida qo'shing — fon
   shaffof, faqat ism va hisob ko'rinadi.

## Loyihaning tuzilishi

```
backend/     Express + Socket.io API server (port 4000)
frontend/    React (Vite) — ommaviy sayt + admin panel + hakam interfeysi + overlay
```

To'liq funksional talablar, ma'lumotlar bazasi sxemasi va production arxitektura
uchun "TZ v1.2" Word hujjatiga qarang.
