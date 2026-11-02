# Saytni kompyuteringizda ishga tushirish (Docker'siz)

Kerak: **Node.js 22+** (https://nodejs.org). Boshqa hech narsa o'rnatish shart emas — baza (PostgreSQL) ham
`local\` ichidagi dastur orqali o'zi ishlaydi.

1. `1-setup.bat` — faqat BIR MARTA (10–15 daqiqa): paketlar, API va sayt yig'iladi.
2. `2-start.bat` — har safar: baza + API + sayt ochiladi, brauzer `http://localhost:3000` ni o'zi ochadi.
3. `3-stop.bat` — to'xtatish. Ma'lumotlar `local\pgdata` da saqlanadi.

Demo kirish (faqat lokal): admin@uztt.uz / admin123 · hakam1@uztt.uz / hakam123 · operator@uztt.uz / operator123

## Eslatmalar
- Kodni o'zgartirsangiz: `1-setup.bat` ni qayta ishga tushirib qayta yig'ing (paketlar qayta o'rnatilmaydi, tez).
- Toza boshlash: `3-stop.bat`, so'ng `local\pgdata` va `local\.seeded` ni o'chiring.
- Telegram: `apps\api\.env` ga `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` yozing, `2-start.bat` ni qayta ishga tushiring.
- Haqiqiy o'yinchilar bazasini lokalga ko'chirish: serverda `pg_dump`, lokalda `local\pgdata` bazasiga (port 54329,
  foydalanuvchi `uztt`, parol `uztt_local`) `psql` bilan yuklash.
- Windows'da Telegram kartochkasi shriftlari sinalmagan (serverda Docker image'ga shriftlar qo'shilgan).
- Serverda ham xuddi shu qadamlar (Node + PostgreSQL + `pm2` + nginx) bilan Docker'siz ishlatish mumkin.
