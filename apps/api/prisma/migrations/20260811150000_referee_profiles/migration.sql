-- Hakam profili (sertifikat darajasi, faoliyat) va statistikani tez hisoblash
-- uchun o'yinlar jadvalidagi "kim tasdiqlagan" ustuniga indeks.

-- CreateTable
CREATE TABLE "referee_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "certification" TEXT,
    "region" TEXT,
    "since" INTEGER,
    "photo_url" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referee_profiles_user_id_key" ON "referee_profiles"("user_id");

-- CreateIndex
CREATE INDEX "matches_verified_by_user_id_idx" ON "matches"("verified_by_user_id");

-- AddForeignKey
ALTER TABLE "referee_profiles" ADD CONSTRAINT "referee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
