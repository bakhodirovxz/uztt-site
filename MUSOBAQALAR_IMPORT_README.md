# Musobaqalar (turnirlar) — uttf.uz'dan ko'chirildi

## Nima qilindi

uttf.uz'ning "Musobaqalar" bo'limiga jonli kirib, uning ichki API'sini
(`/api/table-tennis/tournaments/index`, `.../detail`) to'g'ridan-to'g'ri
so'rab, **hozirda u yerda ro'yxatga olingan barcha 50 ta turnirni** to'liq
ko'chirib oldim:

- Nomi, boshlanish/tugash sanasi, hudud/manzil
- Musobaqa darajasi (Respublika chempionati/kubogi → **Respublika**;
  Pro-tur, Osiyo/Jahon chempionati, Olimpiada → **Ochiq** — bularning
  barchasi bizning saytimizdagi 4 ta mavjud darajadan biriga moslashtirildi)
- Yosh toifasi (agar turnirda faqat bitta toifa bo'lsa — U11...U19/Kattalar)
- Jinsi (agar faqat erkak yoki faqat ayol bo'lsa; aralash bo'lsa — bo'sh
  qoldirildi, chunki ikkalasi ham qatnashadi)
- Holati (**Tugagan/Bo'lib o'tmoqda/Kelayotgan**) — bugungi sana bilan
  taqqoslab avtomatik hisoblandi
- Banner rasmi (5 ta noyob rasm, 46/50 turnirda federatsiyaning umumiy
  banneri ishlatilgan, qolgan 4 tasida o'ziga xos rasm bor edi — barchasi
  ko'chirildi)

**Fayllar:**
- `uttf-tournaments-import.sql` — asosiy import skripti
- `apps/web/public/uttf-import/tournaments/*.jpg` — 5 ta banner rasm

## Ataylab qilmagan narsa (muhim!)

**O'yin-o'yin natijalari (guruh jadvali, play-off setka, har bir o'yinning
hisobi) BU SAFAR KO'CHIRILMADI.** Buning sababi: uttf.uz'da bu ma'lumot har
bir turnir uchun alohida — yosh toifasi × jins × o'yin turi (yakkalik/
juftlik/aralash/jamoaviy) × bosqich (guruh/play-off) kesimida saqlanadi.
50 ta turnirning har birida bir nechta shunday kesim bo'lishi mumkin —
buni to'liq va xatosiz ko'chirish alohida, ancha katta ish (har turnir uchun
o'nlab qo'shimcha so'rov, keyin bizning `matches`/`draws` jadvalimizga to'g'ri
moslashtirish).

Hozircha "Musobaqalar" bo'limi turnirlar ro'yxati va har birining umumiy
ma'lumoti (sana, manzil, daraja, banner) bilan to'ladi — bu ancha katta
yaxshilanish (avval butunlay bo'sh edi). Agar natijalar/jadval ham kerak
bo'lsa, ayting — buni keyingi bosqich sifatida qilib beraman.

## Ishga tushirish

`apps/api` papkasidan:

```
psql "$env:DATABASE_URL" -f ..\..\uttf-tournaments-import.sql
```

Skript **idempotent** — qayta ishga tushirsangiz ham xavfsiz (`ON CONFLICT
(slug) DO UPDATE` — mavjud turnirning holati/banneri yangilanadi, dublikat
qatorlar hosil bo'lmaydi). Test bazamda ikki marta ishga tushirib
tekshirdim: ikkalasida ham aynan 50 ta turnir, boshqa hech narsaga (5520 ta
haqiqiy o'yinchiga) tegmadi.

Ishga tushirgach `apps/web/public/uttf-import/tournaments/` papkasidagi 5 ta
rasm fayli ham albatta o'z joyida turishi kerak (arxivdan chiqarilganda
avtomatik joylashadi) — aks holda banner rasmlar ko'rinmaydi.
