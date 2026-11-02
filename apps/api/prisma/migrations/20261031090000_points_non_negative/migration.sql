-- Reglament: reyting ballari faqat BUTUN va 0 dan kichik emas.
-- 1) Mavjud manfiy ballarni 0 ga tenglaymiz (ustunlar Int, kasr bo'lishi mumkin emas).
-- 2) Kelajakda manfiy yozilib ketmasligi uchun CHECK cheklovlari.
-- Idempotent: qayta ishga tushsa ham zarar yo'q.

UPDATE "players"      SET "ranking_points" = 0 WHERE "ranking_points" < 0;
UPDATE "partnerships" SET "points"         = 0 WHERE "points" < 0;
UPDATE "teams"        SET "points"         = 0 WHERE "points" < 0;
UPDATE "ranking_snapshot_entries" SET "points" = 0 WHERE "points" < 0;

ALTER TABLE "players"      DROP CONSTRAINT IF EXISTS "players_ranking_points_nonneg";
ALTER TABLE "players"      ADD CONSTRAINT "players_ranking_points_nonneg" CHECK ("ranking_points" >= 0);

ALTER TABLE "partnerships" DROP CONSTRAINT IF EXISTS "partnerships_points_nonneg";
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_points_nonneg" CHECK ("points" >= 0);

ALTER TABLE "teams"        DROP CONSTRAINT IF EXISTS "teams_points_nonneg";
ALTER TABLE "teams"        ADD CONSTRAINT "teams_points_nonneg" CHECK ("points" >= 0);
