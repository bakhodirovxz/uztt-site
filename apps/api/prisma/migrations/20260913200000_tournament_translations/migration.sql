-- Musobaqa nomlarining tarjimalari.
-- uttf.uz tournaments/detail nameUz / nameRu / nameEng beradi; ilgari
-- import faqat inglizchasini saqlagan va sayt uch tilli bo'lsa ham
-- musobaqa nomi hamma joyda inglizcha chiqardi.
CREATE TABLE "tournament_translations" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tournament_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournament_translations_tournament_id_locale_key"
    ON "tournament_translations"("tournament_id", "locale");

ALTER TABLE "tournament_translations"
    ADD CONSTRAINT "tournament_translations_tournament_id_fkey"
    FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
