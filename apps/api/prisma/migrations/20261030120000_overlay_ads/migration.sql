-- OBS overlay reklamalari (bo'sh vaqtda ko'rsatiladi). Faqat yangi jadval — mavjud ma'lumotga tegmaydi.
CREATE TABLE "overlay_ads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "duration_s" INTEGER NOT NULL DEFAULT 10,
    "tables" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overlay_ads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "overlay_ads_enabled_sort_order_idx" ON "overlay_ads"("enabled", "sort_order");
