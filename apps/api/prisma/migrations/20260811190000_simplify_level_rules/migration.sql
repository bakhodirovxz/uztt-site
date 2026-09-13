-- Reglament soddalashtirildi: bosqichma-bosqich ballar va "finalda ishtirok"
-- olib tashlandi. Endi to'rtta qiymat: ishtirok, guruhdan chiqish,
-- har bir g'alaba, chempionlik.
--
-- Mavjud ma'lumot: GROUP_ADVANCE va CHAMPION saqlanadi, ROUND_1_WIN → WIN
-- (bazaviy g'alaba balli), qolgan bosqich ballari o'chiriladi.

-- 1) Yangi modelda yo'q qiymatlarni tashlaymiz
DELETE FROM "level_points_rules"
WHERE "key"::text NOT IN ('ROUND_1_WIN', 'GROUP_ADVANCE', 'CHAMPION');

-- 2) Ustunni vaqtincha matnga o'tkazamiz (enum qiymatini o'zgartirish uchun)
ALTER TABLE "level_points_rules" ALTER COLUMN "key" TYPE text USING "key"::text;

-- 3) Bazaviy g'alaba balli yangi nom oladi
UPDATE "level_points_rules" SET "key" = 'WIN' WHERE "key" = 'ROUND_1_WIN';

-- 4) Enumni qayta yaratamiz
DROP TYPE "PointRuleKey";
CREATE TYPE "PointRuleKey" AS ENUM (
  'PARTICIPATION',
  'GROUP_ADVANCE',
  'WIN',
  'CHAMPION'
);

-- 5) Ustunni yangi enumga qaytaramiz
ALTER TABLE "level_points_rules"
  ALTER COLUMN "key" TYPE "PointRuleKey" USING "key"::"PointRuleKey";
