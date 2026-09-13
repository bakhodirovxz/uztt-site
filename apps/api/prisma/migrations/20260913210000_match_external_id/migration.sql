-- uttf.uz dagi matchId ni saqlash uchun.
-- Busiz qayta import har safar bir xil o'yinlarni dublikat qilardi —
-- Partnership bilan bo'lgan xatoning aynan o'zi (u yerda unique cheklov
-- umuman yo'q edi va skript ikkinchi marta ishga tushganda 788 qator
-- ikkilanardi).
ALTER TABLE "matches" ADD COLUMN "external_id" INTEGER;
CREATE UNIQUE INDEX "matches_external_id_key" ON "matches"("external_id");
