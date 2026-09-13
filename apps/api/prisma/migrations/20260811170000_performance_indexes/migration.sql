-- Ishlash indekslari (o'lchov asosida):
--  * overlay/zal monitori har necha soniyada "shu stoldagi o'yin" so'raydi,
--  * hakam statistikasi match_events'ni actorUserId bo'yicha guruhlaydi,
--  * musobaqa sahifasi kategoriya bo'yicha ariza sonlarini oladi.

-- CreateIndex
CREATE INDEX "matches_table_number_status_idx" ON "matches"("table_number", "status");

-- CreateIndex
CREATE INDEX "match_events_actor_user_id_type_idx" ON "match_events"("actor_user_id", "type");

-- CreateIndex
CREATE INDEX "tournament_registrations_tournament_category_id_status_idx" ON "tournament_registrations"("tournament_category_id", "status");
