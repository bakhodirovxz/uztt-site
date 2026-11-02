ALTER TABLE "news_articles" ADD COLUMN "external_id" INTEGER;
CREATE UNIQUE INDEX "news_articles_external_id_key" ON "news_articles"("external_id");
