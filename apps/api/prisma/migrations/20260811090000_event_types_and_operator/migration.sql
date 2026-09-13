-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SINGLES', 'DOUBLES', 'MIXED_DOUBLES', 'TEAM');

-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'WITHDRAWN';

-- DropIndex
DROP INDEX "tournament_categories_tournament_id_age_category_id_gender_key";

-- AlterTable
ALTER TABLE "player_points_log" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "tournament_categories" ADD COLUMN     "event_type" "EventType" NOT NULL DEFAULT 'SINGLES',
ALTER COLUMN "gender" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tournament_registrations" ADD COLUMN     "partner_player_id" TEXT,
ADD COLUMN     "status_changed_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_by_id" TEXT,
ADD COLUMN     "status_reason" TEXT,
ADD COLUMN     "team_name" TEXT;

-- CreateTable
CREATE TABLE "player_age_categories" (
    "player_id" TEXT NOT NULL,
    "age_category_id" TEXT NOT NULL,

    CONSTRAINT "player_age_categories_pkey" PRIMARY KEY ("player_id","age_category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_categories_tournament_id_age_category_id_gender__key" ON "tournament_categories"("tournament_id", "age_category_id", "gender", "event_type");

-- AddForeignKey
ALTER TABLE "player_age_categories" ADD CONSTRAINT "player_age_categories_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_age_categories" ADD CONSTRAINT "player_age_categories_age_category_id_fkey" FOREIGN KEY ("age_category_id") REFERENCES "age_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_points_log" ADD CONSTRAINT "player_points_log_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_partner_player_id_fkey" FOREIGN KEY ("partner_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_status_changed_by_id_fkey" FOREIGN KEY ("status_changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

