# Juftlik / Aralash juftlik / Jamoaviy reyting — o'rnatish qo'llanmasi

## Nima qo'shildi
- **Partnership** jadvali — Juftlik (bir xil jinsli) va Aralash juftlik reytinglari, har biri yosh toifasi (U9/U11/U13/U15/U17/U19/Kattalar) bilan.
- **Team** jadvali — Jamoaviy reyting, jins (erkak/ayol/aralash) va yosh toifasi bo'yicha ajratilgan.
- Backend: `GET /rankings/doubles`, `GET /rankings/mixed`, `GET /rankings/teams` (barchasi `?gender=` va `?ageCategory=` filtrlarini qabul qiladi).
- Frontend: `/rankings` sahifasida endi 4 ta tab bor — Yakkalik, Juftlik, Aralash juftlik, Jamoaviy.

## MUHIM: ilgari yuborilgan fayllarda xatolik topildi va tuzatildi
Birinchi marta yuborilgan `schema.prisma` va import skriptida **Jamoaviy (Team) jadvali uchun xato** bor edi: uttf.uz'da bitta jamoa (masalan, "Farg'ona viloyati") har bir yosh toifasi va jins uchun alohida qator sifatida saqlangan (369 ta qator, lekin faqat 51 ta noyob jamoa ID'si). Eski skript jamoa ID'sini yagona (unique) kalit deb hisoblab, faqat 51 ta qatorni saqlar, qolgan 318 tasini (barcha yosh toifalari bo'yicha taqsimotni) tashlab yuborar edi.

**Tuzatildi:** endi jamoa yagona kaliti (`external_id`, `age_category_id`, `gender`) uchligi — barcha 369 ta qator to'g'ri saqlanadi. Ushbu papkadagi fayllar — TUZATILGAN versiya. Agar avvalgi `schema.prisma`/migratsiya/skriptni allaqachon qo'llagan bo'lsangiz, quyidagi qadamlarni bajaring (hali qo'llamagan bo'lsangiz ham xuddi shu qadamlar ishlaydi).

## O'rnatish qadamlari

1. **Fayllarni almashtiring** (mavjud fayllar ustidan yozilsin):
   - `schema.prisma` → `apps/api/prisma/schema.prisma`
   - `migration/migration.sql` → `apps/api/prisma/migrations/20260816164126_add_partnerships_and_teams/migration.sql`
   - `import-uttf-rankings-extra.py` → `apps/api/scripts/import-uttf-rankings-extra.py` (ixtiyoriy, faqat kelajakda qayta scrape qilish uchun kerak)

   Agar avvalgi (xato) migratsiyani **allaqachon** `prisma migrate deploy` bilan qo'llagan bo'lsangiz — avval buni ayting, alohida tuzatish migratsiyasi kerak bo'ladi. Aks holda pastdagi buyruqlarni to'g'ridan-to'g'ri bajaraverish mumkin.

2. Terminalda:
   ```
   cd apps\api
   pnpm prisma migrate deploy
   pnpm prisma generate
   ```

3. Ma'lumotlarni yuklash — `uttf-rankings-import-data.sql` faylini loyihaning ILDIZ papkasiga (`uztt-site\`) joylashtiring, so'ng:
   ```
   pnpm prisma db execute --file ..\..\uttf-rankings-import-data.sql --schema prisma\schema.prisma
   ```
   (buyruqni `apps\api` papkasida turib ishga tushiring — yo'l avvalgi importdagi kabi)

   Bu skript:
   - 7 ta yosh toifasini qo'shadi (agar allaqachon bo'lsa — o'tkazib yuboradi)
   - 5435 ta o'yinchiga yosh toifasini biriktiradi
   - 788 ta Juftlik/Aralash juftlik yozuvini qo'shadi
   - 369 ta Jamoaviy yozuvni qo'shadi

   **Diqqat:** ushbu faylni faqat BIR MARTA ishga tushiring. Agar ikkinchi marta ishga tushirsangiz, "duplicate key" xatolari chiqadi — bu normal, chunki fayl bitta tranzaksiya ichida bo'lgani uchun hech narsa ikki marta yozilmaydi (xato chiqsa, hammasi ROLLBACK bo'ladi, ma'lumotlar buzilmaydi).

4. Dev serverni qayta ishga tushiring va `/rankings` sahifasini oching — 4 ta tab (Yakkalik/Juftlik/Aralash juftlik/Jamoaviy) va ularning jins/yosh toifasi filtrlari ishlashi kerak.

## Tekshirish (ixtiyoriy, DB'da to'g'ridan-to'g'ri)
```sql
select count(*) from age_categories;      -- 7
select count(*) from partnerships;         -- 788
select count(*) from teams;                -- 369
select count(*) from players where age_category_id is not null;  -- 5435
```
