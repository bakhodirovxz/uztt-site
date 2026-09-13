# uttf.uz dizaynini nusxalash — 1-bosqich

## Nima qilindi
Chrome orqali **uttf.uz**'ning haqiqiy dizaynini (rang, shrift, logotip) jonli saytdan o'qib oldim va o'sha qiymatlarni saytimizga qo'ydim:

- **Logotip**: uttf.uz'dagi haqiqiy emblema (`https://uttf.uz/logo.png`) yuklab olindi va `apps/web/public/uttf-logo.png` sifatida qo'shildi. Header va footer'da eski qizil "TT" doiracha o'rniga shu ishlatiladi.
- **Rang sxemasi**: uttf.uz **OCH (light) fon** ishlatadi, faqat navy-ko'k (~#33487A) tugmalar/aktiv holatlar va AntD-uslub yorqin ko'k (~#325ECD) ball/havolalar uchun. Eski sayt esa **to'liq DARK theme** bilan qurilgan edi — bu asosiy nomuvofiqlik edi. `globals.css`dagi dizayn tokenlarini (`--color-surface`, `--color-ink`, `--color-border`, va h.k.) to'liq och rangga o'zgartirdim — bu o'zgarish 47 tadan ortiq komponentga avtomatik tarqaladi (chunki ular semantik token nomlaridan foydalanadi).
- **Header**: uttf.uz'dagi kabi 2 qatorli qilib qayta qurdim — yuqorida logotip + tashkilot nomi + telefon/email + til almashtirgich + "Kirish" tugmasi (navy), pastda asosiy navigatsiya (REYTING, MUSOBAQALAR va h.k., faol havola navy rang + tagcha chiziq bilan). "JONLI" havolasi yonida uttf.uz'dagi kabi qizil pulsatsiya nuqtasi qo'shdim.
- **Footer**: haqiqiy logotip bilan yangilandi, fon rangi navy-ko'k (uttf.uz'dagi kabi) qoldi.
- **Reyting sahifasi** (`/rankings`): jadval sarlavhasi (thead) endi och kulrang fon + qora matn (avval to'q ko'k fon + oq matn edi — uttf.uz'da aynan shunday). Tab/filtr tugmalari uttf.uz'dagi kabi konturli (border) uslubga o'tkazildi, faol holat — navy fon + oq matn. Ball ustuni AntD-uslub yorqin ko'k rangga bo'yaldi.

## Ataylab O'ZGARTIRILMAGAN qismlar
- **`/screen/*`** sahifalari (proyektor/televizor uchun to'liq ekran hisob taxtasi) va **OBS overlay** — bular ataylab to'q fonda qoladi, chunki translyatsiya/proyektor grafikasi har doim to'q fonda yaxshi ko'rinadi (bu barcha sport translyatsiyalarida standart amaliyot).
- Bosh sahifadagi katta "hero" bo'limi va boshqa ba'zi sahifalardagi kichik rasmli-fon joylar (masalan, yangilik kartochkalari) hozircha navy-ko'k urg'u sifatida qoldi — bu keyingi bosqichda uttf.uz'dagi rasmli karusel bilan almashtirilishi mumkin (alohida so'rov kerak, chunki bu katta qo'shimcha komponent).

## Fayllarni joylashtirish
Ushbu arxivdagi `web-src/` papkasi ichidagi fayllarni **xuddi shu papka tuzilishi bilan** loyihaning `apps/web/src/` papkasiga (va `uttf-logo.png`ni `apps/web/public/`ga) nusxalang:

```
web-src/styles/globals.css              → apps/web/src/styles/globals.css
web-src/components/layout/*.tsx         → apps/web/src/components/layout/
web-src/app/(site)/[locale]/rankings/page.tsx → apps/web/src/app/(site)/[locale]/rankings/page.tsx
web-src/uttf-logo.png                   → apps/web/public/uttf-logo.png
```

Keyin:
```
cd apps\web
pnpm dev
```
(yoki productionda `pnpm build && pnpm start`) va brauzerni **hard refresh** (Ctrl+Shift+R) qiling — eski CSS keshi ko'rinishni buzishi mumkin.

## MUHIM: skrinshotda ko'ringan "Test O'yinchi" / "Yangi Oyinchi" haqida
Yuborgan skrinshotingizda reytingda "Test O'yinchi" (5180 ball) va "Yangi Oyinchi" nomli o'yinchilar chiqib turibdi — bular haqiqiy uttf.uz ma'lumoti EMAS, balki loyihani sinov qilish uchun yaratilgan **dev/test hisoblar** (`prisma/seed.ts` ichidagi `oyinchi@uztt.uz` test akkaunti va sinov paytida ro'yxatdan o'tkazilgan boshqa yozuv). Ularning balli sun'iy yuqori (5180) bo'lgani uchun haqiqiy o'yinchilardan (eng yuqorisi ~700 ball) tepada chiqib qolyapti.

Bu ma'lumotlarni production bazangizdan o'zim o'chirmadim (chunki `oyinchi@uztt.uz` kabi test hisoblar jamoangizga sinov uchun kerak bo'lishi mumkin). Agar xohlasangiz, keyingi xabaringizda ayting — men xavfsiz SQL tozalash buyrug'ini tayyorlab beraman (faqat sun'iy/test yozuvlarni o'chiradigan, haqiqiy 5520 ta o'yinchiga tegmaydigan).

## Keyingi qadam (agar xohlasangiz)
Bosh sahifa va boshqa ichki sahifalarni (Musobaqalar, Klublar, Yangiliklar ro'yxati va h.k.) uttf.uz'ning rasmli-karusel va batafsil komponent tuzilishiga yanada yaqinlashtirish — bu alohida, kattaroq bosqich bo'ladi. Nima ustida davom etishimni ayting.
