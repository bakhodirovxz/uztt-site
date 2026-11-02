# Qoidalar ↔ sayt: to'liq jadval

Manbalar: **Nizom** (O'zSTF reyting ballari berish tartibi — docx/pptx) va **Musobaqa qoidalari** (PDF, 93 bet: 1–4-bo'limlar, Положение, 28 ta ilova).
Belgilar: ✅ bajarildi (kod + test) · 🟡 qisman · ⬜ hali yo'q · ➖ dasturga aloqasi yo'q (jihoz, kiyim, ma'muriy).

## Nizom (reyting)
| Band | Qoida | Holat | Joyi |
|---|---|---|---|
| 16 | Р = ЖР + К·МРБ − Ж + Б | ✅ | `rankings/rating.engine.ts` |
| 17, 1-ilova | K (chempionat 1 / kubok 0.9 / hududiy 0.5, yosh bo'yicha, pro-tur 0.1–1) | ✅ | `tournamentK`, `TournamentLevel.ratingK`, `CUP` darajasi |
| 18–20 | G'olib (100−farq)/10; mag'lub −(100−farq)/20; teng reytingda ±10; farq>100 — ball yo'q | ✅ | engine + `matches.service.awardOfficial` |
| 21 | Texnik g'alabada ball yo'q | ✅ | diskvalifikatsiya/raqibsiz — ball berilmaydi |
| 22 | Jarohat bo'lsa oxirgi hisob qayd etiladi | ✅ | o'yin natijasi hisobi saqlanadi |
| 17, 2-ilova | 1–8-o'rin bonusi, jarima (Ж) | ✅ | bonus o'yin tugashi bilan avtomatik (final 1/2, 3-o'rin o'yini 3/4, chorak final yutqazgani 5) va efir sahnasida ko'rinadi; qo'lda: `POST /rankings/tournaments/:id/bonuses[?apply=1]`, jarima `/penalty` |
| 23–24 | Natijalar 3 ish kunida; ro'yxat har oyning 1-ish kunida | 🟡 | snapshot bor; avtomatik oylik cron tekshirilmagan |
| 25–26 | Player ID, ro'yxat ustunlari (ЖШШИР, o'zgarish, maktab…) | 🟡 | asosiy ustunlar bor; "oldingi reyting/o'rin farqi" snapshotdan |
| 27–28 | Yosh toifalari ro'yxatlari | ✅ | toifa bo'yicha reyting |
| 28 | Ro'yxatdan chiqarish (2 yil qatnashmagan, ixtiyoriy, qoida buzish…) | ✅ | `POST /rankings/players/:id/exclude|restore`, `GET /rankings/inactive` (avtomatik chiqarmaydi — Ijroiya qo'mitasi qarori) |
| 30–35 | Boshlang'ich reyting va razryad ballari (50–500) | ⬜ | ariza oqimi va jadval yozilmagan |
| 38–39 | Qura reyting bo'yicha; hududiy ro'yxat | ✅ | qura endi qoidalar bo'yicha (pastda) |
| 44–47 | Apellyatsiya (1 hafta, uchta qaror turi) | ✅ | `POST /appeals`, `/appeals/:id/decision` (API; o'yinchi kabineti UI yo'q) |
| — | Ball faqat butun, ≥ 0 | ✅ | `common/points.ts`, CHECK cheklov |

## Qoidalar: 1-bo'lim (turlar, ishtirokchilar)
| Band | Qoida | Holat |
|---|---|---|
| 1.1 | Shaxsiy / jamoaviy / shaxsiy-jamoaviy, yakka-juft-aralash | 🟡 yakka ✅; juft/aralash ro'yxatga olish bor, jamoaviy o'yin yo'q |
| 1.2 | Yosh guruhlari, yosh 31-dekabr holatiga | 🟡 sayt yosh = turnir yili − tug'ilgan yil (O'zbekiston Nizomi toifalari 11/13/15/17/19); BY qoidasidagi 31-dekabr usuli qo'llanmagan |
| 1.3 | Ruxsat (shifokor), kichik yoshlilar kattalar bilan (tren. kengashi ruxsati) | 🟡 kichiklar kattalarda qatnasha oladi; shifokor ruxsati maydoni yo'q |
| 1.4–1.6 | Ishtirokchi/vakil huquq-majburiyatlari | ➖ |

## 2-bo'lim (o'yin qoidalari)
| Band | Holat |
|---|---|
| 2.10–2.12 Ochko, 11 ochko/2 farq, toq setlar | ✅ `scoring.engine.ts` |
| 2.13 Podacha: 2 ochkoda almashadi, 10:10 dan keyin har ochkoda | ✅ `serverSlot` |
| 2.13.7–8 Oxirgi setda 5 ochkoda tomon almashish | ✅ hakam ekranida eslatma (`sideChangeDue`) |
| 2.15 Tezlashtirish qoidasi (10 daqiqa, 13 qaytarish) | ⬜ |
| 2.1–2.9, 2.14, 2.16–2.20 Stol, to'p, raketka, kiyim, zal | ➖ |

## 3-bo'lim (hakamlik, intizom, qura)
| Band | Qoida | Holat |
|---|---|---|
| 3.4.4.2 | Taym-aut: har o'yinchiga 1 marta, 1 daqiqa | ✅ API + hakam tugmasi + TV va overlayda KATTA panel (hisoblagich ≈175 px) |
| 3.5.2.2–4 | Sariq ogohlantirish; 2-qoidabuzarlik — raqibga 1 ochko; 3-sida 2 ochko; 4-sida bosh hakamga xabar | ✅ `matches.service.card` |
| 3.5.2.8–10 | Bosh hakam diskvalifikatsiyasi (o'yin / musobaqa) | 🟡 o'yin bo'yicha ✅; "ikki o'yinda diskvalifikatsiya = turdan chiqarish" avtomatik emas |
| 3.5.2.11 | Diskvalifikatsiyada medal/ball/pul olib tashlanadi | 🟡 jarima (Ж) qo'lda `/penalty` |
| 3.3 | Protestlar: faqat o'yinchi, faqat talqin/tashkiliy masala | ✅ `appeals` (o'yin FAKTI bo'yicha protest — qabul qilinmaydi: 3.3.2, matn shartida) |
| 3.6.1–3.6.2 | Setka 2ⁿ, BYE, seedlar jereb bilan | ✅ `draw.engine.ts: drawByRules` |
| 3.6.3 | Bir tashkilot/viloyat o'yinchilarini ajratish | ✅ (viloyat bo'yicha, eng uzoq uchrashuv raundi) |
| 3.6.4–3.6.6 | Tayyor setkani o'zgartirish, qayta qura, qo'shimcha ishtirokchi | ⬜ |
| 13–14-ilova | 3-o'rin uchun o'yin (yarim final yutqazganlari) | ✅ `THIRD_PLACE`, bonus 3- va 4-o'rinni ajratadi |
| 28-ilova | BYE o'rinlari jadvali (8/16/32/64) | ✅ test jadvalga aynan mos |

## 4-bo'lim (tashkil etish)
| Band | Qoida | Holat |
|---|---|---|
| 4.2.1 | Guruhda g'alaba 2, mag'lubiyat 1, kelmaslik/tugatmaslik 0 | ✅ `draws/groups.engine.ts` |
| 4.2.2–4.2.4 | Tenglikda faqat o'zaro o'yinlar: ochko → set nisbati → ochko nisbati, aniqlanganlar chiqarilib qayta hisob, so'ng jereb | ✅ 27-ilova misollari testda |
| 4.2.5 | Guruhdagi oxirgi o'yin 1–2 (yoki 2–3…) o'rin orasida | 🟡 Berger jadvalida 4 kishida 1–2; boshqa chiquvchilar soni uchun tartib yo'q |
| 4.2.6 | 50% dan kam o'ynagan — natijalari bekor | ✅ (yakuniy hisobda) |
| 4.2.7 | O'ynalmagan/tugallanmagan uchrashuv: 3–0, 11:0, qisman set | ✅ |
| 4.3.1–4.3.6 | Jamoaviy tizimlar (Sveytling x3, Korbilon, olimpiya, Evans), tartib, jamoa hajmi | 🟡 sof funksiyalar + testlar `teams/team.engine.ts`; jamoaviy o'yin ma'lumotlar bazasi/hakam ekrani/efir yo'q |
| 4.4 | Jamoaviy match tartibi (A/B/C…), g'olib ko'pchilik | 🟡 funksiyalar bor, saqlash yo'q |
| 4.5.3–4.5.4 | Stollar soni, kunlik/smenadagi me'yor, N(N−1)/2 | 🟡 `schedule/schedule.rules.ts` funksiyalari; jadval tuzishda avtomatik tekshiruv ulanmagan |
| 4.6.1.1 | Musobaqa ishtirokchisi hakam bo'la olmaydi | ✅ o'yinchi o'z o'yinida kodni tasdiqlay olmaydi (murabbiy tekshiruvi — ⬜) |
| 4.6.18 | Reytingni faqat a'zo/to'lov qilganlar uchun hisoblash | 🟡 INACTIVE ball olmaydi; a'zolik to'lovi maydoni yo'q |
| 4.7.1 | Qura amaldagi reyting bo'yicha; jamoa/juft reytingi | ✅ juft/jamoa reytingi funksiyalari (`team.engine.ts`) |
| 4.7.2 | Zmeyka va o'zgartirilgan zmeyka, tashkilot bo'yicha ajratish (ustuvor) | ✅ `snakeDraw` |
| 4.7.3 | Guruhdan setkaga joylashtirish (1,2,3,4-o'rinlar) | ✅ `placeQualifiers` + `POST /groups/category/:id/advance` |
| 4.7.4 | Ko'p bosqichli (saralash → setka) boshqa variantlar | ⬜ |
| 4.8 | Hisobot 7 kunda; reyting hisobchisiga 3 kunda | ⬜ avtomatik hisobot generatsiyasi yo'q |

## Положение va ilovalar
| Ilova | Holat |
|---|---|
| Положение maydonlari (tur, muddat, tizim, setlar soni, mukofot…) | 🟡 turnir kartasida asosiylari bor (nom, daraja, sana, joy, jins, yosh) |
| 1–10 Jamoa arizasi va protokollar | ⬜ (PDF/chop etish shakllari) |
| 11–12 Doira jadvali tartibi | ✅ (Berger; ETTU usuli jadvali rasm — qo'llanmagan) |
| 13–14 Setka 3-o'rin o'yini bilan | ✅ |
| 15–20 Setka turlari (8(−1), 16(−2), 24, 32 — barcha o'rinlar) | ⬜ faqat to'g'ridan-to'g'ri chiqish + 3-o'rin o'yini |
| 21 Doira jadvali | ✅ |
| 22 Belarus reyting-tizimi (boshqa formula) | ➖ O'zbekiston Nizomi qo'llanadi |
| 23 Hakamlik terminologiyasi, 26 Imo-ishoralar | ➖ |
| 24 To'liq hisobot mazmuni | ⬜ |
| 25 Raketka tekshiruvi | ➖ |
| 27 Guruh hisoblash misollari | ✅ testlarda aynan takrorlangan |
| 28 Setkadagi bo'sh joylar | ✅ |

## Hakamlar, murabbiylar, klublar (v7)
| Band | Qoida | Holat |
|---|---|---|
| 4.6.1.1 | Ishtirokchi o'z musobaqasida/o'yinida hakam bo'la olmaydi | ✅ tayinlashda va kod kiritishda tekshiriladi |
| 4.6.12–13 | Yetakchi hakam va hakam-yordamchi har o'yinga | ✅ avtomatik (setka/guruh saqlanganda va o'yin tugaganda) + qo'lda almashtirish |
| — | Bir vaqtda ikki o'yinda emas; final/yarim finalga yuqori toifa; yuklama teng; o'z hududidan xolis | ✅ `assignment.engine.ts` (11 unit test) |
| — | Hakam/murabbiy bo'lib ro'yxatdan o'tish, admin tasdig'i | ✅ `/join/referee`, `/join/coach`, panel → Arizalar |
| — | Klub ochish so'rovi va ommaviy klublar ro'yxati | ✅ `/clubs`, `/clubs/open`, panel → Arizalar → Klublar |
| — | Rasmlar: jadval/setka/TV/overlayda | ✅ kichik (96 px) nusxalar, lazy, 30 kun kesh |

## Yosh segmentlari (reyting)
Kumulyativ: U-9, U-11, U-13, U-15, U-17, U-19 — shu yosh VA undan kichik hamma o'yinchi (U-15 ichida U-13 dagilar ham bor); Kattalar — hamma. Yosh = joriy yil − tug'ilgan yil. Chegara kiritiladimi (13 yoshli U-13 ga kiradimi) — `apps/api/src/common/age.ts` dagi `AGE_LIMIT_INCLUSIVE` (hozir `true`, uttf.uz ga mos). Bazadagi natija: U-9 261, U-11 1023, U-13 1964, U-15 2826, U-17 3425, U-19 4029, Kattalar 5520.

## Sizdan qarorlar
1. **Mag'lubdan ball ayirish**: Nizom 19-band ayiradi (sayt shunday). Efir dasturi (scoreboard)da sozlama alohida (`loserNoDeduct`).
2. **Rejim**: barcha darajalar OFFICIAL (`UPDATE tournament_levels SET rating_mode='LEGACY' WHERE code='…'` — orqaga qaytarish).
3. **Yosh hisoblash**: 31-dekabr usulini (BY qoidasi) yoki turnir yili usulini (hozirgi) tanlang — Nizomda aniq yozilmagan.
4. **Qolgan katta ishlar** (ketma-ket): jamoaviy o'yinlar (baza + hakam + efir), setkaning barcha o'rinlarni aniqlovchi turlari (15–20-ilovalar), guruhlarni yaratish/setkaga o'tkazish admin sahifasi (hozir API; natijalar saytda "Guruhlar" bo'limida ko'rinadi), tezlashtirish qoidasi (2.15), boshlang'ich reyting (razryad) arizasi, hisobot generatsiyasi.

## Hududlar
Barcha hududlar o'zbekcha (migratsiya `regions_uz` + import skriptlari + `common/regions.ts`). Efir kartochkalarida qisqa shakl: Farg'ona, Qoraqalpog'iston, Toshkent sh., Toshkent vil.
