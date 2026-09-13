-- Musobaqa darajasi endi REGLAMENT: har daraja o'z ball jadvaliga ega
-- (guruh g'alabasi, guruhdan chiqish, setkadagi g'alabalar, finalda ishtirok,
-- chempionlik). Reglament yo'q darajalar eski usulda ishlaydi:
-- bosqich balli × koeffitsiyent.

-- CreateEnum
CREATE TYPE "PointRuleKey" AS ENUM (
  'GROUP_WIN',
  'GROUP_ADVANCE',
  'ROUND_1_WIN',
  'ROUND_OF_32_WIN',
  'ROUND_OF_16_WIN',
  'QUARTERFINAL_WIN',
  'SEMIFINAL_WIN',
  'FINAL_APPEARANCE',
  'CHAMPION'
);

-- AlterTable
ALTER TABLE "tournament_levels" ADD COLUMN     "description" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "level_points_rules" (
    "level_id" TEXT NOT NULL,
    "key" "PointRuleKey" NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "level_points_rules_pkey" PRIMARY KEY ("level_id","key")
);

-- AddForeignKey
ALTER TABLE "level_points_rules" ADD CONSTRAINT "level_points_rules_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "tournament_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
