-- Musobaqa sahifasidagi "Yangiliklar" / "Galereya" / "Videolar" tablari uchun
-- kontentni turnirga bog'lash. Galereya va videoda ustun bor edi, lekin
-- tashqi kalitsiz — endi bog'lanish qat'iy (turnir o'chsa NULL bo'ladi).

-- AlterTable
ALTER TABLE "news_articles" ADD COLUMN     "tournament_id" TEXT;

-- CreateIndex
CREATE INDEX "news_articles_tournament_id_idx" ON "news_articles"("tournament_id");

-- CreateIndex
CREATE INDEX "galleries_tournament_id_idx" ON "galleries"("tournament_id");

-- CreateIndex
CREATE INDEX "videos_tournament_id_idx" ON "videos"("tournament_id");

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
