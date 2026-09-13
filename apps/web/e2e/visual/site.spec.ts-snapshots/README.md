# Vizual baseline'lar — hozircha BO'SH (ataylab)

Bu papkada 26 ta `-win32.png` baseline turardi. Ular WTT redizaynidan
**oldingi** holatni muhrlagan edi va dizayn tizimi almashgach (token qiymatlari,
393 ta shrift classi, qora xrom) hammasi yaroqsiz bo'lib qoldi.

Yaroqsiz baseline — yo'q baseline'dan yomonroq: u har testda qizil chiqadi va
odamni refleks bilan `--update-snapshots` bosishga o'rgatadi, bu esa suite'ning
butun qiymatini yo'q qiladi.

## Qachon qayta yaratiladi

Sahifa to'lqinlari tugab, dizayn barqarorlashgandan keyin — **bitta, faqat
PNG'lardan iborat commitda**:

```bash
cd apps/web
pnpm test:visual:update
```

## Undan OLDIN tuzatilishi kerak

`site.spec.ts` maskalari `[data-live]` va `.live-ticker` selektorlarini
nishonlaydi, lekin ikkalasi ham `components/match/live-ticker.tsx` da
MAVJUD EMAS — ya'ni maskalash umuman ishlamayapti. Avval tuzatilmasa, yangi
baseline'lar o'zgaruvchan jonli hisobni ichiga muhrlaydi va doimiy
"flaky" xatolar beradi.

## Eslatma

Fayl nomlari `-win32` bilan tugaydi — bu baseline'lar faqat Windows'da mos
keladi, Linux CI'da yaroqsiz.
