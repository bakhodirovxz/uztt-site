-- 3-o'rin uchun o'yin (bonus jadvali 3- va 4-o'rinni alohida beradi)
ALTER TYPE "MatchStage" ADD VALUE IF NOT EXISTS 'THIRD_PLACE';
ALTER TABLE "matches"
  ADD COLUMN "loser_next_match_id" TEXT,
  ADD COLUMN "loser_next_match_slot" INTEGER;
