-- Rasmiy reyting (O'zSTF Nizomi): daraja rejimi, K koeffitsiyenti, aniq ball.
CREATE TYPE "RatingMode" AS ENUM ('LEGACY', 'OFFICIAL');

ALTER TABLE "tournament_levels"
  ADD COLUMN "rating_k" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN "rating_mode" "RatingMode" NOT NULL DEFAULT 'OFFICIAL';

ALTER TABLE "player_points_log" ADD COLUMN "exact" DOUBLE PRECISION;

-- Nizom 1-ilova: mavjud darajalar uchun K (keyin admin paneldan o'zgartirish mumkin)
UPDATE "tournament_levels" SET "rating_k" = 1.0 WHERE "code" = 'NATIONAL';
UPDATE "tournament_levels" SET "rating_k" = 0.5 WHERE "code" IN ('REGIONAL', 'OPEN');
UPDATE "tournament_levels" SET "rating_k" = 0.1 WHERE "code" = 'CLUB';

-- O'zbekiston kubogi (K = 0.9) — alohida daraja
INSERT INTO "tournament_levels" ("id", "code", "name", "description", "coefficient", "rating_k", "rating_mode", "sort_order")
SELECT gen_random_uuid()::text, 'CUP', 'O''zbekiston kubogi', 'Respublika kubogi (Nizom 1-ilova, K = 0.9)', 1.0, 0.9, 'OFFICIAL', 1
WHERE NOT EXISTS (SELECT 1 FROM "tournament_levels" WHERE "code" = 'CUP');
