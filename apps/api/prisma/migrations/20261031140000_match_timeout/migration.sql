-- Taym-aut (musobaqa qoidalari 3.4.4.2): har o'yinchiga bir marta, 1 daqiqagacha
ALTER TYPE "MatchEventType" ADD VALUE IF NOT EXISTS 'TIMEOUT';
ALTER TABLE "matches"
  ADD COLUMN "timeout_p1_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "timeout_p2_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "timeout_player" INTEGER,
  ADD COLUMN "timeout_until" TIMESTAMP(3);
