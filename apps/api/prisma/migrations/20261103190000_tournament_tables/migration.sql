-- Musobaqa stollari: faqat yangi ustunlar, mavjud ma'lumot o'zgarmaydi
ALTER TABLE "tournaments" ADD COLUMN "table_count" INTEGER;
ALTER TABLE "tournaments" ADD COLUMN "main_tables" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
