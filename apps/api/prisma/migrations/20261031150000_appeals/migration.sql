-- Apellyatsiya / protest (Nizom 44–47, qoidalar 3.3)
CREATE TYPE "AppealKind" AS ENUM ('RATING', 'INTERPRETATION', 'ORGANIZATION');
CREATE TYPE "AppealStatus" AS ENUM ('NEW', 'REJECTED', 'ACCEPTED', 'RECALCULATE');

CREATE TABLE "appeals" (
  "id" TEXT NOT NULL,
  "kind" "AppealKind" NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'NEW',
  "player_id" TEXT NOT NULL,
  "match_id" TEXT,
  "text" TEXT NOT NULL,
  "decision" TEXT,
  "decided_by_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "appeals_status_created_at_idx" ON "appeals"("status", "created_at");
CREATE INDEX "appeals_player_id_idx" ON "appeals"("player_id");
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
