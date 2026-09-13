-- To'liq matnli qidiruv (FTS) va typeahead uchun trigram indekslar.
-- ILIKE '%...%' o'rniga: yangiliklar tsvector bo'yicha, ismlar esa
-- pg_trgm o'xshashligi bo'yicha topiladi (xato yozilgan harflarga chidamli).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Yangilik tarjimalari: sarlavha (A) > qisqa matn (B) > to'liq matn (C).
-- Til bo'yicha konfiguratsiya: ru → russian, en → english, qolgani → simple
-- (o'zbek tili uchun stemmer yo'q, simple aynan shu holat uchun).
ALTER TABLE "news_translations"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    CASE "locale"
      WHEN 'ru' THEN
        setweight(to_tsvector('russian', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('russian', coalesce("excerpt", '')), 'B') ||
        setweight(to_tsvector('russian', coalesce("body", '')), 'C')
      WHEN 'en' THEN
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excerpt", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("body", '')), 'C')
      ELSE
        setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('simple', coalesce("excerpt", '')), 'B') ||
        setweight(to_tsvector('simple', coalesce("body", '')), 'C')
    END
  ) STORED;

CREATE INDEX "news_translations_search_vector_idx"
  ON "news_translations" USING GIN ("search_vector");

-- O'yinchi typeahead: to'liq ism bo'yicha trigram (ILIKE ham shu indeksdan foydalanadi)
CREATE INDEX "players_full_name_trgm_idx"
  ON "players" USING GIN ((lower("first_name" || ' ' || "last_name")) gin_trgm_ops);

CREATE INDEX "players_club_trgm_idx"
  ON "players" USING GIN (lower(coalesce("club", '')) gin_trgm_ops);

-- Musobaqa nomlari bo'yicha qidiruv
CREATE INDEX "tournaments_name_trgm_idx"
  ON "tournaments" USING GIN (lower("name") gin_trgm_ops);
