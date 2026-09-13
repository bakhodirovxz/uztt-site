-- Club modeli (uttf.uz'dan klublar/jamoalar ma'lumotlarini import qilish uchun)
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "club_type" TEXT,
    "region_name" TEXT,
    "district_name" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone_number" TEXT,
    "coach_name" TEXT,
    "manager_name" TEXT,
    "table_count" INTEGER,
    "logo_url" TEXT,
    "external_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clubs_slug_key" ON "clubs"("slug");
CREATE UNIQUE INDEX "clubs_external_id_key" ON "clubs"("external_id");

ALTER TABLE "players" ADD COLUMN "club_id" TEXT;
CREATE INDEX "players_club_id_idx" ON "players"("club_id");

ALTER TABLE "players" ADD CONSTRAINT "players_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
