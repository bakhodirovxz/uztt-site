-- Juftlik/Aralash juftlik (Partnership) va Jamoaviy (Team) reytinglari uchun jadvallar

CREATE TABLE "partnerships" (
    "id" TEXT NOT NULL,
    "category" "EventType" NOT NULL,
    "player1_id" TEXT NOT NULL,
    "player2_id" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "ranking" INTEGER,
    "age_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partnerships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partnerships_category_points_idx" ON "partnerships"("category", "points");
CREATE INDEX "partnerships_age_category_id_idx" ON "partnerships"("age_category_id");

ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_player1_id_fkey"
  FOREIGN KEY ("player1_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_player2_id_fkey"
  FOREIGN KEY ("player2_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partnerships" ADD CONSTRAINT "partnerships_age_category_id_fkey"
  FOREIGN KEY ("age_category_id") REFERENCES "age_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region_name" TEXT,
    "district_name" TEXT,
    "gender" "Gender",
    "age_category_id" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "ranking" INTEGER,
    "external_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_external_id_age_category_id_gender_key" ON "teams"("external_id", "age_category_id", "gender");
CREATE INDEX "teams_age_category_id_gender_points_idx" ON "teams"("age_category_id", "gender", "points");

ALTER TABLE "teams" ADD CONSTRAINT "teams_age_category_id_fkey"
  FOREIGN KEY ("age_category_id") REFERENCES "age_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
