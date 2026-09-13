-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PointsLogReason" AS ENUM ('MATCH_WIN', 'UNDO', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('GROUP', 'ROUND_1', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('VERIFY', 'POINT', 'UNDO', 'CARD', 'DISQUALIFY');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'WAITLIST');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('SELF', 'ADMIN', 'COACH');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('PENDING', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PlayerDocumentType" AS ENUM ('PASSPORT', 'ID_CARD', 'BIRTH_CERTIFICATE');

-- CreateEnum
CREATE TYPE "StreamChannelType" AS ENUM ('OVERLAY', 'SCREEN');

-- CreateEnum
CREATE TYPE "GalleryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('EXECUTIVE', 'STAFF');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('TECHNICAL', 'MEDIA', 'LEGAL');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "age_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_age" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "age_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_levels" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "tournament_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_points" (
    "stage" "MatchStage" NOT NULL,
    "base_points" INTEGER NOT NULL,

    CONSTRAINT "stage_points_pkey" PRIMARY KEY ("stage")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birth_date" DATE,
    "age_category_id" TEXT,
    "region" TEXT NOT NULL,
    "club" TEXT,
    "license_number" TEXT,
    "ranking_points" INTEGER NOT NULL DEFAULT 0,
    "photo_url" TEXT,
    "country_code" TEXT NOT NULL DEFAULT 'UZ',
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_points_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "PointsLogReason" NOT NULL,
    "match_id" TEXT,
    "tournament_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_points_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "city" TEXT,
    "venue" TEXT,
    "gender" "Gender",
    "age_category_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "banner_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "stage" "MatchStage" NOT NULL DEFAULT 'ROUND_1',
    "table_number" INTEGER,
    "scheduled_at" TIMESTAMP(3),
    "best_of" INTEGER NOT NULL DEFAULT 5,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "player1_id" TEXT,
    "player2_id" TEXT,
    "winner_id" TEXT,
    "player1_sets_won" INTEGER NOT NULL DEFAULT 0,
    "player2_sets_won" INTEGER NOT NULL DEFAULT 0,
    "current_set_p1" INTEGER NOT NULL DEFAULT 0,
    "current_set_p2" INTEGER NOT NULL DEFAULT 0,
    "referee_code_hash" TEXT NOT NULL,
    "referee_code_attempts" INTEGER NOT NULL DEFAULT 0,
    "referee_code_locked" BOOLEAN NOT NULL DEFAULT false,
    "referee_verified_at" TIMESTAMP(3),
    "verified_by_user_id" TEXT,
    "overlay_token" TEXT NOT NULL,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "disqualified_player_id" TEXT,
    "disqualification_reason" TEXT,
    "disqualification_audio_url" TEXT,
    "draw_id" TEXT,
    "round_number" INTEGER,
    "bracket_position" INTEGER,
    "next_match_id" TEXT,
    "next_match_slot" INTEGER,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_sets" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "p1_points" INTEGER NOT NULL,
    "p2_points" INTEGER NOT NULL,

    CONSTRAINT "match_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_cards" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player" INTEGER NOT NULL,
    "type" "CardType" NOT NULL,
    "set_number" INTEGER NOT NULL,
    "issued_by_user_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" "MatchEventType" NOT NULL,
    "payload" JSONB,
    "actor_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_categories" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "age_category_id" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "max_entries" INTEGER,
    "registration_deadline" TIMESTAMP(3),

    CONSTRAINT "tournament_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_registrations" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "tournament_category_id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "RegistrationSource" NOT NULL DEFAULT 'SELF',
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draws" (
    "id" TEXT NOT NULL,
    "tournament_category_id" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_entries" (
    "id" TEXT NOT NULL,
    "draw_id" TEXT NOT NULL,
    "player_id" TEXT,
    "seed" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "draw_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_documents" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "type" "PlayerDocumentType" NOT NULL,
    "document_number_enc" TEXT,
    "file_path_enc" TEXT,
    "expiry_date" DATE,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "club" TEXT,
    "license_number" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_players" (
    "coach_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_players_pkey" PRIMARY KEY ("coach_id","player_id")
);

-- CreateTable
CREATE TABLE "stream_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "StreamChannelType" NOT NULL,
    "table_number" INTEGER NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stream_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "category" TEXT,
    "tournament_id" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_translations" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "video_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galleries" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "cover_url" TEXT,
    "status" "GalleryStatus" NOT NULL DEFAULT 'PUBLISHED',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "galleries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_translations" (
    "id" TEXT NOT NULL,
    "gallery_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "gallery_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "gallery_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumb_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "credit" TEXT,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "type" "StaffType" NOT NULL,
    "photo_url" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_translations" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "bio" TEXT,

    CONSTRAINT "staff_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_documents" (
    "id" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_document_translations" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "federation_document_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "website_url" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "thumb_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT,
    "cover_image_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_translations" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,

    CONSTRAINT "news_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "age_categories_code_key" ON "age_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_levels_code_key" ON "tournament_levels"("code");

-- CreateIndex
CREATE UNIQUE INDEX "players_slug_key" ON "players"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "players_license_number_key" ON "players"("license_number");

-- CreateIndex
CREATE UNIQUE INDEX "players_user_id_key" ON "players"("user_id");

-- CreateIndex
CREATE INDEX "players_gender_ranking_points_idx" ON "players"("gender", "ranking_points");

-- CreateIndex
CREATE INDEX "player_points_log_player_id_created_at_idx" ON "player_points_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "player_points_log_match_id_idx" ON "player_points_log"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_status_start_date_idx" ON "tournaments"("status", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "matches_overlay_token_key" ON "matches"("overlay_token");

-- CreateIndex
CREATE INDEX "matches_tournament_id_status_idx" ON "matches"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_sets_match_id_set_number_key" ON "match_sets"("match_id", "set_number");

-- CreateIndex
CREATE INDEX "match_cards_match_id_idx" ON "match_cards"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_match_id_seq_key" ON "match_events"("match_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_categories_tournament_id_age_category_id_gender_key" ON "tournament_categories"("tournament_id", "age_category_id", "gender");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_registrations_player_id_tournament_category_id_key" ON "tournament_registrations"("player_id", "tournament_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "draw_entries_draw_id_position_key" ON "draw_entries"("draw_id", "position");

-- CreateIndex
CREATE INDEX "player_documents_player_id_idx" ON "player_documents"("player_id");

-- CreateIndex
CREATE INDEX "document_access_logs_document_id_idx" ON "document_access_logs"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_user_id_key" ON "coach_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stream_profiles_user_id_key" ON "stream_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stream_profiles_type_table_number_key" ON "stream_profiles"("type", "table_number");

-- CreateIndex
CREATE INDEX "videos_published_at_idx" ON "videos"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "video_translations_video_id_locale_key" ON "video_translations"("video_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_translations_gallery_id_locale_key" ON "gallery_translations"("gallery_id", "locale");

-- CreateIndex
CREATE INDEX "photos_gallery_id_idx" ON "photos"("gallery_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_translations_staff_id_locale_key" ON "staff_translations"("staff_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "federation_document_translations_document_id_locale_key" ON "federation_document_translations"("document_id", "locale");

-- CreateIndex
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "news_articles_status_published_at_idx" ON "news_articles"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "news_translations_article_id_locale_key" ON "news_translations"("article_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "news_translations_locale_slug_key" ON "news_translations"("locale", "slug");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_age_category_id_fkey" FOREIGN KEY ("age_category_id") REFERENCES "age_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_points_log" ADD CONSTRAINT "player_points_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "tournament_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_age_category_id_fkey" FOREIGN KEY ("age_category_id") REFERENCES "age_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_cards" ADD CONSTRAINT "match_cards_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_age_category_id_fkey" FOREIGN KEY ("age_category_id") REFERENCES "age_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_category_id_fkey" FOREIGN KEY ("tournament_category_id") REFERENCES "tournament_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_tournament_category_id_fkey" FOREIGN KEY ("tournament_category_id") REFERENCES "tournament_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_entries" ADD CONSTRAINT "draw_entries_draw_id_fkey" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_documents" ADD CONSTRAINT "player_documents_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "player_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_players" ADD CONSTRAINT "coach_players_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_translations" ADD CONSTRAINT "video_translations_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_translations" ADD CONSTRAINT "gallery_translations_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_translations" ADD CONSTRAINT "staff_translations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_document_translations" ADD CONSTRAINT "federation_document_translations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "federation_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_translations" ADD CONSTRAINT "news_translations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

