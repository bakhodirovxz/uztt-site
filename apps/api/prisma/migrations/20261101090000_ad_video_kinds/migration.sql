-- Reklama turlari: rasm / qisqa rolik / promo rolik
CREATE TYPE "AdKind" AS ENUM ('IMAGE', 'VIDEO', 'PROMO');
ALTER TABLE "overlay_ads" ADD COLUMN "kind" "AdKind" NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "overlay_ads" ADD COLUMN "video_url" TEXT;
ALTER TABLE "overlay_ads" ALTER COLUMN "image_url" DROP NOT NULL;
-- Rolik reklamada manzil majburiy, rasm reklamada rasm majburiy
ALTER TABLE "overlay_ads" ADD CONSTRAINT "overlay_ads_media_chk"
  CHECK (("kind" = 'IMAGE' AND "image_url" IS NOT NULL) OR ("kind" <> 'IMAGE' AND "video_url" IS NOT NULL));
