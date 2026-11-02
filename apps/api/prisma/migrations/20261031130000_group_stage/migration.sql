-- Guruh bosqichi (doira tizimi): musobaqa qoidalari 4.2, 4.7.2–4.7.3
CREATE TYPE "GroupStageStatus" AS ENUM ('ACTIVE', 'ADVANCED');

CREATE TABLE "group_stages" (
  "id" TEXT NOT NULL,
  "tournament_category_id" TEXT NOT NULL,
  "group_count" INTEGER NOT NULL,
  "advancing" INTEGER NOT NULL,
  "best_of" INTEGER NOT NULL DEFAULT 5,
  "status" "GroupStageStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_stages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "group_stages_tournament_category_id_key" ON "group_stages"("tournament_category_id");
ALTER TABLE "group_stages" ADD CONSTRAINT "group_stages_tournament_category_id_fkey"
  FOREIGN KEY ("tournament_category_id") REFERENCES "tournament_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tournament_groups" (
  "id" TEXT NOT NULL,
  "stage_id" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  CONSTRAINT "tournament_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tournament_groups_stage_id_number_key" ON "tournament_groups"("stage_id", "number");
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_stage_id_fkey"
  FOREIGN KEY ("stage_id") REFERENCES "group_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "group_entries" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "group_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "group_entries_group_id_player_id_key" ON "group_entries"("group_id", "player_id");
CREATE UNIQUE INDEX "group_entries_group_id_position_key" ON "group_entries"("group_id", "position");
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "tournament_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "matches" ADD COLUMN "group_id" TEXT, ADD COLUMN "group_round" INTEGER;
CREATE INDEX "matches_group_id_idx" ON "matches"("group_id");
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "tournament_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
