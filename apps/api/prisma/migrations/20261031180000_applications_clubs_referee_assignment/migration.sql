-- Hakam/murabbiy ommaviy ariza, klub ochish, hakamlarni o'yinlarga tayinlash
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "RefereeCategory" AS ENUM ('INTERNATIONAL', 'NATIONAL', 'FIRST', 'SECOND', 'THIRD');
CREATE TYPE "ClubStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- Mavjud hakamlar/murabbiylar/klublar APPROVED/ACTIVE bo'lib qoladi (default)
ALTER TABLE "referee_profiles"
  ADD COLUMN "status" "ApplicationStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "category" "RefereeCategory",
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reject_reason" TEXT,
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);
CREATE INDEX "referee_profiles_status_idx" ON "referee_profiles"("status");

ALTER TABLE "coach_profiles"
  ADD COLUMN "status" "ApplicationStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "club_id" TEXT,
  ADD COLUMN "reject_reason" TEXT,
  ADD COLUMN "reviewed_by_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

ALTER TABLE "clubs"
  ADD COLUMN "status" "ClubStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "owner_user_id" TEXT,
  ADD COLUMN "reject_reason" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);
CREATE INDEX "clubs_status_idx" ON "clubs"("status");
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_club_id_fkey"
  FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "matches"
  ADD COLUMN "referee_user_id" TEXT,
  ADD COLUMN "assistant_user_id" TEXT,
  ADD COLUMN "referee_assigned_at" TIMESTAMP(3);
CREATE INDEX "matches_referee_user_id_idx" ON "matches"("referee_user_id");
CREATE INDEX "matches_assistant_user_id_idx" ON "matches"("assistant_user_id");
ALTER TABLE "matches" ADD CONSTRAINT "matches_referee_user_id_fkey"
  FOREIGN KEY ("referee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_assistant_user_id_fkey"
  FOREIGN KEY ("assistant_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Yangi huquqlar (seed production'da ishlamaydi — shu yerda beriladi)
INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid()::text, 'applicant.review', 'Hakam/murabbiy/klub arizalarini ko''rib chiqish (tasdiqlash/rad etish)'),
  (gen_random_uuid()::text, 'referee.assign', 'Hakamlarni o''yinlarga tayinlash (avtomatik va qo''lda)'),
  (gen_random_uuid()::text, 'club.manage', 'Klublarni yaratish va tahrirlash')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
 WHERE r."code" IN ('SUPERADMIN', 'ADMIN') AND p."code" IN ('applicant.review', 'referee.assign', 'club.manage')
ON CONFLICT DO NOTHING;
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r, "permissions" p
 WHERE r."code" = 'OPERATOR' AND p."code" = 'referee.assign'
ON CONFLICT DO NOTHING;
