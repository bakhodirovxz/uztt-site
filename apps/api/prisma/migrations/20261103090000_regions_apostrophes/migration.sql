-- 20261031170000_regions_uz dan qolgan dumni yopish: apostrofning boshqa
-- turlari (‘ ’ ʻ ʼ ` ´) bilan yozilgan TO'LIQ hudud nomlari xaritaga
-- tushmay qolgan edi. Prod nusxasida "Farg‘ona viloyati" (34 o'yinchi)
-- "Farg'ona viloyati" (456) dan alohida hudud bo'lib turardi.
--
-- Taqqoslash kodi bilan bir xil: src/common/regions.ts → regionKey().
-- Idempotent: qayta ishga tushsa hech narsa o'zgarmaydi.
CREATE TEMP TABLE _region_canon(uz TEXT PRIMARY KEY);
INSERT INTO _region_canon(uz) VALUES
  ('Toshkent shahri'), ('Toshkent viloyati'), ('Andijon viloyati'),
  ('Buxoro viloyati'), ('Farg''ona viloyati'), ('Jizzax viloyati'),
  ('Xorazm viloyati'), ('Namangan viloyati'), ('Navoiy viloyati'),
  ('Qashqadaryo viloyati'), ('Qoraqalpog''iston Respublikasi'),
  ('Samarqand viloyati'), ('Sirdaryo viloyati'), ('Surxondaryo viloyati');

CREATE FUNCTION pg_temp.region_key(v TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(lower(btrim(v)), E'[‘’ʻʼ`´]', '''', 'g'),
           '\s+', ' ', 'g')
$$;

UPDATE "players" x SET "region" = c.uz FROM _region_canon c
 WHERE pg_temp.region_key(x."region") = pg_temp.region_key(c.uz) AND x."region" <> c.uz;
UPDATE "clubs" x SET "region_name" = c.uz FROM _region_canon c
 WHERE pg_temp.region_key(x."region_name") = pg_temp.region_key(c.uz) AND x."region_name" <> c.uz;
UPDATE "teams" x SET "region_name" = c.uz FROM _region_canon c
 WHERE pg_temp.region_key(x."region_name") = pg_temp.region_key(c.uz) AND x."region_name" <> c.uz;

DROP TABLE _region_canon;
