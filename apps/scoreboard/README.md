# Stol tennisi scoreboard — ko'p stolli (standart 10 ta), planshet + TV + YouTube overlay

Faqat Node.js kerak (nodejs.org). Windows'da `start.bat` ni ikki marta bosing.
Bayroqlar loyiha ichida (internet kerak emas).

## Qanday ishlaydi
- Har stolda 1 ta planshet. Stol raqami havolada: `/control?court=1` ... `/control?court=10`
- Hamma stollar uchun 1 ta TV: `/tv` — faqat **faol** o'yinlarni ko'rsatadi: 1 ta o'yin bo'lsa 1 ta,
  2 ta bo'lsa 2 ta, 4 ta bo'lsa 4 ta, 8 tagacha (o'lcham avtomatik moslanadi)
- Har stolning 1 ta overlay'i (YouTube/OBS): `/overlay?court=1` ... `court=10`
- Bosh sahifa `/` — hamma havolalar jadvali; `/admin` — qura, reklama, sozlamalar; `/live` — tomoshabinlar uchun
- 2 ta TV bo'lsa: `/tv?courts=1,2,3,4` va `/tv?courts=5,6,7,8`

## Har o'yin oldidan (planshetda)
1. "⚙ Yangi o'yin / sozlamalar" ni oching
2. Stol, tur (MEN'S TEAMS), bosqich (PRELIMINARY ROUND 3), o'yinchilar (familiya, ism, davlat kodi: IRQ, KAZ, UZB, IRI, SGP...) ni yozing
3. Jamoaviy uchrashuv bo'lsa "jamoa hisobini ko'rsatish" ni belgilab, yutuqlarni kiriting (IRQ 0-1 KAZ)
4. Formatni tanlang (3/5/7 geym) va "▶ Yangi o'yinni boshlash va TV'ga chiqarish" ni bosing
5. Uzatuvchi bo'lgan o'yinchida "Uzatuvchi" tugmasini bosing, keyin ball maydoniga bosib ball kiritasiz
   (birinchi ball bosilganda stol TV ga o'zi chiqadi)
- O'yin tugagach TV da g'olib ("WINNER") bilan 60 soniya ko'rinadi va o'zi yo'qoladi
  (o'zgartirish: `/tv?hide=30`). Qo'lda olib tashlash: sozlamalardagi "O'yinni TV'dan olib tashlash"
- TV sarlavhasi (ITTF-ATTU Asian Championships / Tashkent 2026 (UZB)): sozlamalarning pastida,
  bir marta o'zgartirilsa hamma stollarga o'tadi

## TV dizayni
Yashil fon, har stol uchun panel: stol/tur/bosqich sarlavhasi, bayroq + familiya/ism, har geym uchun katak
(tugagan geym hisobi, joriy geym sariq hoshiya bilan jonli), o'ngda yutilgan geymlar. 5 geymli o'yinda
rasmdagidek 2 ta "+" katak ko'rinadi (bezak). GAME POINT / MATCH POINT, TIME-OUT hisoblagichi, uzatuvchi (sariq nuqta).
Logotiplar: `public` papkaga `logo-left.png` va `logo-right.png` fayllarini tashlasangiz, sarlavhaning ikki yonida chiqadi.

## YouTube (OBS)
OBS -> Sources -> Browser -> URL: `http://localhost:3100/overlay?court=1`, 1920 x 1080. Fon shaffof.
Overlay doim ko'rinib turadi (OBS'da sahifa manbasini yoqib/o'chirasiz).
- Stolning o'yini davom etayotganda: pastki chap burchakda ixcham overlay (shu stol hisobi)
- O'yin tugagach (10 soniya g'olib ko'rsatilgach): overlay butun ekranli UMUMIY scoreboard'ga o'tadi
  va boshqa stollarning JONLI o'yinlarini ko'rsatadi (3 ta jonli bo'lsa 3 ta, 2 ta bo'lsa 2 ta, 1 ta bo'lsa 1 ta).
  Jonli o'yin qolmasa, yaqinda tugaganlari natijasi chiqadi.
- Shu stolda yangi o'yin boshlanishi bilan overlay o'zi ixcham ko'rinishga qaytadi
- Kutish vaqti: `/overlay?court=1&wait=5` (soniya, standart 10)

## Yangi imkoniyatlar (v6)

### O'yinchilar statistikasi (TV va overlay, 22 soniya)
Planshetdan o'yinchilar tanlanib (yoki qurudan o'yin boshlanib) "boshlash" bosilganda TV va shu stol overlay'ida to'liq ekranli sahna chiqadi:
rasm, umumiy reyting ball va o'rin, yosh, hudud, nechta o'yin o'ynagan / yutgan / yutqazgan. Birinchi ball berilishi bilan sahna **o'zi yopiladi**.
Planshetning pastki o'ng burchagidagi tugma bilan qo'lda yopish yoki (ball berilmagan bo'lsa) qayta ko'rsatish mumkin.
- Ma'lumot manbai: `players-db.json` (uttf.uz reytingi, 5520 o'yinchi), rasmlar `public/players/`. O'yinchilar ism-familiya bo'yicha
  avtomatik topiladi; topilmaganlarini `/admin` → "Bazaga bog'lash" da qo'lda bog'lang.
- Statistika (o'yin/yutuq/yutqazish) shu musobaqadagi tugagan o'yinlardan (`history.json`) hisoblanadi.
- Davomiylik va yoqish/o'chirish: `/admin` → "Statistika va reyting sozlamalari". TV'da sahnani o'chirish: `/tv?scenes=0`; ingliz o'rniga o'zbekcha yozuv: `?lang=uz`.

### O'yindan keyin reyting yangilanishi (animatsiya)
O'yin tugagach (4 soniyadan keyin, 14 soniya) TV va overlay'da ikkala o'yinchining reytingi eski qiymatdan yangisiga sanab o'tadi,
+/− ball va reytingdagi o'rin o'zgarishi ko'rsatiladi. Hisob: `lib/rating.js` (g'olib (100 − (G'R − YuR)) / 10, mag'lub −(100 − (G'R − YuR)) / 20,
teng reytingda +10 / −10, so'ng К koeffitsientiga ko'paytiriladi). Texnik g'alaba (ball o'ynalmagan) va bazada yo'q o'yinchilar hisobga olinmaydi.
"↶" bekor qilish o'yin natijasini ham, reyting o'zgarishini ham qaytaradi. Natija Telegram xabariga ham qo'shiladi.
**Muhim:** formulalar loyiha yozuvlaridan tiklangan — rasmiy Nizom bilan solishtiring (`lib/rating.js` boshidagi izoh).

### Overlay reklamalari
`/admin` → "Overlay reklamalari": rasm yoki video yuklang, har biriga vaqt, stollar (masalan `1,2`) va tartib bering.
Stolda o'yin bo'lmagan bo'sh vaqtda (o'yin boshlanmagan yoki tugab, ko'rsatadigan jonli o'yin qolmaganda) navbatma-navbat chiqadi.
"Jonli o'yinlar orasida ham" yoqilsa, umumiy scoreboard o'rtasida har N soniyada bitta reklama chiqadi. "Sinab ko'rish": `/overlay?court=1&ad=<id>`.
Stolda o'yin boshlanmaguncha overlay endi shaffof (yoki reklama) — avvalgidek "PLAYER 1/2" chiqmaydi.

### Ommaviy veb-ilova (tomoshabinlar uchun) — `/live`
Telefonda ochiladi: jonli hisob, o'yinlar jadvali (stol/tur bo'yicha filtr), natijalar, musobaqa reytingi (qidiruv bilan). UZ/EN/RU.

### Telegramga natija rasmi (1920×1080 va 1080×1920)
O'yin tugashi bilan Telegram guruhiga avval matn natijasi, keyin ikkita rasm yuboriladi: gorizontal (1920×1080) va vertikal (1080×1920, hikoya/telefon uchun).
Reyting hisoblangan bo'lsa — reyting yangilanishi kartochkasi (rasm, o'zgarish, o'rin, reyting jadvali), bo'lmasa — geymlar hisobi bilan natija kartochkasi.
- Rasm kompyuterdagi **Microsoft Edge** (yoki Chrome) yordamida olinadi — alohida dastur o'rnatish shart emas. Boshqa joyda bo'lsa: `set BROWSER_PATH=C:\...\chrome.exe`.
- Tekshirish: bitta o'yinni tugatib, brauzerda `http://localhost:3100/api/telegram-test?photo=1` ni oching.
- Ko'rish: `http://localhost:3100/card?key=last` (oxirgi tugagan o'yin kartochkasi, `&fmt=v` — vertikal ko'rinish uchun brauzer oynasini tor qiling).

### Umumiy saytga ulash
- Iframe: `<iframe src="http://KOMPYUTER_IP:3100/live?embed=1" style="width:100%;height:900px;border:0"></iframe>`
- Ma'lumot (JSON, CORS ochiq): `/api/public` (jonli, jadval, natijalar, reyting), `/api/all`, jonli oqim `/events?all=1`.

### Yuk sinovi (men o'tkazdim)
500 o'yinchi, 10 stol bir vaqtda o'ynaydi, 10 planshet + 10 TV + 10 overlay (30 ta haqiqiy brauzer oynasi) + 150 tomoshabin: POST kechikishi o'rtacha 2 ms (p95 116 ms),
jonli yangilanish p95 0.3 s, server CPU o'rtacha ~10%, xotira ~130 MB. Planshet har bir qurilmaga faqat o'z stolini oladi (tarmoq tejaladi).

## Stol tennisi (ITTF) qoidalari — avtomatik
- Geym 11 ballgacha, 2 ball farq bilan. Format 3/5/7 geym (standart 5 geymdan 3)
- Uzatish har 2 ballda, 10-10 dan keyin har 1 ballda. Keyingi geymda avval qabul qilgan birinchi uzatadi
- Tomon almashish: har geymdan keyin va hal qiluvchi geymda 5 ballda (faqat planshetdagi joylashuv almashadi;
  TV va overlayda 1-o'yinchi doim tepada)
- Taym-aut: har o'yinchiga 1 ta, 60 soniya (TV va overlayda hisoblagich)
- Juftliklar: familiya maydoniga "CHEN / WANG" deb yozing

## Planshet tugmalari
Ball maydoniga bosish +1. "−1" xatoni tuzatadi. "Taym-aut" har o'yinchiga o'yin davomida 1 marta.
"⇄" tomonni qo'lda almashtiradi (odatda avtomatik). Tepa chap burchakdagi xira "↶" oxirgi amalni bekor qiladi.

## Telegram (natija avtomatik yuboriladi)
O'yin tugashi bilan (3 geym yutilganda yoki hakam "✓ O'yinni yakunlash" ni bosganda) natija Telegramga boradi:
stol/tur/bosqich, o'yinchilar, geymlar hisobi va g'olib. Har o'yin uchun 1 marta.
1. Telegramda @BotFather ga `/newbot` yozing, bot yarating va TOKEN ni oling.
2. Botga biror xabar yozing (yoki botni guruh/kanalga qo'shing, kanalda admin qiling).
3. Brauzerda `https://api.telegram.org/bot<TOKEN>/getUpdates` ni oching, `"chat":{"id":...}` raqamini toping (guruhda -100... bo'ladi).
4. `telegram.json` ni oching va `token` hamda `chat_id` ni yozing, `start.bat` ni qayta ishga tushiring.
5. Tekshirish: brauzerda `http://localhost:3100/api/telegram-test`
Internet o'chib qolsa, server 3 marta qayta urinadi.
"✓ O'yinni yakunlash": tugamagan o'yinni (masalan, o'yinchi chiqib ketsa) yakunlaydi — g'olib: ko'p geym yutgan,
teng bo'lsa joriy geymda ko'p ball olgan. Xato bosilsa — tepa chapdagi "↶" bekor qiladi (Telegram xabari esa ketgan bo'ladi).

## Eslatma
Hisob `state.json` ga yoziladi (server qayta yoqilsa yo'qolmaydi). Windows Firewall so'rasa:
"Allow (private network)". Hamma qurilma bitta tarmoqda bo'lsin.
Bayroqlar: flag-icons (MIT litsenziya), `public/flags-LICENSE.txt`.
