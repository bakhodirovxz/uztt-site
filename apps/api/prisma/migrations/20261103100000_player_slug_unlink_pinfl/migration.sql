-- Ommaviy o'yinchi manzili (slug) PINFL raqamlaridan qurilmasin.
--
-- uttf importi slug'ni "<ism>-<pinfl[:5]>", uttf-sync esa "<ism>-<pinfl oxirgi 5>" ko'rinishida yasagan. Haqiqiy 14 xonali PINFL'da
-- birinchi 5 raqam = jins/asr + tug'ilgan KUN va OY. Ommaviy "age" bilan birga bu to'liq
-- tug'ilgan sanani beradi (ko'pi voyaga yetmaganlar). Shu suffiks o'yinchi id'sidan olingan,
-- qaytarib bo'lmaydigan 5 belgiga almashtiriladi; band bo'lsa uzunroq (8, 12) belgi olinadi.
-- Faqat license_number raqamli (PINFL ko'rinishidagi) va slug uning boshidagi yoki oxirgi
-- 5 raqami bilan tugaydigan (ixtiyoriy "-N" takror qo'shimchasi bilan) yozuvlar o'zgaradi.
-- Idempotent: yangi suffiks hex (md5), qayta ishga tushirilsa mos kelmaydi.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  len INT;
BEGIN
  FOR r IN
    SELECT id, slug, license_number
    FROM players
    WHERE license_number ~ '^[0-9]{14,}$'
      AND slug ~ ('-(' || left(license_number, 5) || '|' || right(license_number, 5) || ')(-[0-9]+)?$')
  LOOP
    base := regexp_replace(
      r.slug,
      '-(' || left(r.license_number, 5) || '|' || right(r.license_number, 5) || ')(-[0-9]+)?$',
      ''
    );
    IF base = '' THEN
      base := 'oyinchi';
    END IF;
    FOREACH len IN ARRAY ARRAY[5, 8, 12, 32] LOOP
      candidate := base || '-' || left(md5(r.id || 'uztt-slug'), len);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM players WHERE slug = candidate AND id <> r.id);
    END LOOP;
    UPDATE players SET slug = candidate, updated_at = now() WHERE id = r.id;
  END LOOP;
END $$;
