-- Haftalik reyting kesimlari: ▲▼ movement va tarixiy reyting jadvali uchun.

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_auto" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshot_entries" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "age_category_id" TEXT,

    CONSTRAINT "ranking_snapshot_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshots_label_key" ON "ranking_snapshots"("label");

-- CreateIndex
CREATE INDEX "ranking_snapshots_taken_at_idx" ON "ranking_snapshots"("taken_at");

-- CreateIndex
CREATE INDEX "ranking_snapshot_entries_snapshot_id_rank_idx" ON "ranking_snapshot_entries"("snapshot_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ranking_snapshot_entries_snapshot_id_player_id_key" ON "ranking_snapshot_entries"("snapshot_id", "player_id");

-- AddForeignKey
ALTER TABLE "ranking_snapshot_entries" ADD CONSTRAINT "ranking_snapshot_entries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "ranking_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshot_entries" ADD CONSTRAINT "ranking_snapshot_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
