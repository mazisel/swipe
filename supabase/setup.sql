-- Swipe: Supabase SQL Editor kurulumu
-- Kaynak: server/migrations/*.sql. Yenilemek için: node scripts/build-schema.mjs
-- Supabase proje sahibi/postgres rolüyle çalıştırın.
-- Şemayı kurar; yerel verileri veya medya dosyalarını aktarmaz.
-- swipe şemasını Data API exposed schemas listesine eklemeyin.
-- Uygulama mevcut Express giriş sistemiyle çalışır; Supabase Auth kullanmaz.
-- Migration geçmişi sayesinde tekrar çalıştırılabilir. Kayıtları silmez.

BEGIN;
SELECT pg_advisory_xact_lock(47291022);
CREATE SCHEMA IF NOT EXISTS swipe;
REVOKE ALL ON SCHEMA swipe FROM PUBLIC;
SET LOCAL search_path TO swipe, public, extensions;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 001_marketplace.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '001_marketplace.sql') THEN
    CREATE SCHEMA IF NOT EXISTS swipe;
    REVOKE ALL ON SCHEMA swipe FROM PUBLIC;
    CREATE EXTENSION IF NOT EXISTS vector;
    SET search_path TO swipe, public, extensions;
    CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, shop TEXT);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS shop_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), bio TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL CHECK(jsonb_typeof(data::jsonb)='object'), stock INTEGER NOT NULL CHECK(stock>=0));
    CREATE INDEX IF NOT EXISTS products_seller ON products(seller_id);
    CREATE TABLE IF NOT EXISTS uploads (url TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(user_id,request_key));
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_product ON comments(product_id);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, purchase_type TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(product_id,user_id));
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), buyer_id TEXT NOT NULL REFERENCES users(id), seller_id TEXT NOT NULL REFERENCES users(id), buyer_read BIGINT NOT NULL DEFAULT 0, seller_read BIGINT NOT NULL DEFAULT 0, UNIQUE(product_id,buyer_id));
    CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, request_key TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(conversation_id,sender_id,request_key));
    CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,id);
    INSERT INTO swipe.schema_migrations(version) VALUES ('001_marketplace.sql');
  END IF;
END
$swipe_migration$;

-- 002_discovery.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '002_discovery.sql') THEN
    SET search_path TO swipe, public, extensions;
    CREATE TABLE IF NOT EXISTS feed_actors (
     id TEXT PRIMARY KEY, user_id TEXT UNIQUE REFERENCES users(id), token_hash TEXT UNIQUE,
     generation INTEGER NOT NULL DEFAULT 1, merged_into TEXT REFERENCES feed_actors(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS feed_preferences (actor_id TEXT NOT NULL REFERENCES feed_actors(id), kind TEXT NOT NULL CHECK(kind IN ('product','seller')), target_id TEXT NOT NULL, PRIMARY KEY(actor_id,kind,target_id));
    CREATE TABLE IF NOT EXISTS feed_sessions (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES feed_actors(id), generation INTEGER NOT NULL, algorithm TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS feed_sessions_actor ON feed_sessions(actor_id);
    CREATE TABLE IF NOT EXISTS feed_pages (session_id TEXT NOT NULL REFERENCES feed_sessions(id) ON DELETE CASCADE, page INTEGER NOT NULL, product_ids JSONB NOT NULL, next_cursor TEXT, PRIMARY KEY(session_id,page));
    CREATE TABLE IF NOT EXISTS feed_events (
     id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES feed_actors(id), generation INTEGER NOT NULL,
     product_id TEXT NOT NULL REFERENCES products(id), kind TEXT NOT NULL, weight DOUBLE PRECISION NOT NULL,
     session_id TEXT REFERENCES feed_sessions(id) ON DELETE SET NULL, algorithm TEXT NOT NULL,
     impression_id TEXT, duration_ms INTEGER NOT NULL DEFAULT 0, completion DOUBLE PRECISION NOT NULL DEFAULT 0,
     day TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE(actor_id,product_id,kind,day)
    );
    CREATE INDEX IF NOT EXISTS feed_events_actor_time ON feed_events(actor_id,created_at);
    CREATE INDEX IF NOT EXISTS feed_events_product_time ON feed_events(product_id,created_at);
    CREATE TABLE IF NOT EXISTS feed_impressions (
     id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES feed_actors(id), session_id TEXT NOT NULL REFERENCES feed_sessions(id) ON DELETE CASCADE,
     product_id TEXT NOT NULL REFERENCES products(id), generation INTEGER NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0,
     completion DOUBLE PRECISION NOT NULL DEFAULT 0, loops INTEGER NOT NULL DEFAULT 0, qualified BOOLEAN NOT NULL DEFAULT false,
     closed BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS feed_receipts (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES feed_actors(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS feed_profiles (actor_id TEXT PRIMARY KEY REFERENCES feed_actors(id), generation INTEGER NOT NULL, affinities JSONB NOT NULL DEFAULT '{}', embedding vector(768), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS product_features (
     product_id TEXT PRIMARY KEY REFERENCES products(id), content_hash TEXT NOT NULL, model_version TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending', features JSONB NOT NULL DEFAULT '{}', embedding vector(768), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ai_cache (cache_key TEXT PRIMARY KEY, features JSONB NOT NULL, embedding vector(768) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS ai_jobs (
     id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), cache_key TEXT NOT NULL, content_hash TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),
     locked_at TIMESTAMPTZ, last_error TEXT, UNIQUE(product_id,cache_key)
    );
    CREATE INDEX IF NOT EXISTS ai_jobs_queue ON ai_jobs(status,next_attempt);
    CREATE TABLE IF NOT EXISTS ai_budgets (month TEXT PRIMARY KEY, spent_micros BIGINT NOT NULL DEFAULT 0, reserved_micros BIGINT NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ai_charges (
     id TEXT PRIMARY KEY, month TEXT NOT NULL REFERENCES ai_budgets(month), job_id TEXT REFERENCES ai_jobs(id),
     reserved_micros BIGINT NOT NULL, actual_micros BIGINT, status TEXT NOT NULL DEFAULT 'reserved', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS feed_metrics (day TEXT NOT NULL, algorithm TEXT NOT NULL, requests BIGINT NOT NULL DEFAULT 0, total_ms DOUBLE PRECISION NOT NULL DEFAULT 0, max_ms DOUBLE PRECISION NOT NULL DEFAULT 0, PRIMARY KEY(day,algorithm));
    -- This private schema is accessed only by the Express server's database role.
    REVOKE ALL ON ALL TABLES IN SCHEMA swipe FROM PUBLIC;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA swipe FROM PUBLIC;
    DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON SCHEMA swipe FROM anon'; END IF;
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON SCHEMA swipe FROM authenticated'; END IF;
    END $$;
    INSERT INTO swipe.schema_migrations(version) VALUES ('002_discovery.sql');
  END IF;
END
$swipe_migration$;

-- 003_media.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '003_media.sql') THEN
    SET search_path TO swipe, public, extensions;
    CREATE TABLE IF NOT EXISTS media_assets (url TEXT PRIMARY KEY REFERENCES uploads(url), content_hash TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes>0));
    REVOKE ALL ON TABLE media_assets FROM PUBLIC;
    INSERT INTO swipe.schema_migrations(version) VALUES ('003_media.sql');
  END IF;
END
$swipe_migration$;

-- 004_follows_reasons.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '004_follows_reasons.sql') THEN
    SET search_path TO swipe, public, extensions;
    CREATE TABLE shop_follows (
     actor_id TEXT NOT NULL REFERENCES feed_actors(id) ON DELETE CASCADE,
     seller_id TEXT NOT NULL REFERENCES users(id),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY(actor_id,seller_id)
    );
    CREATE INDEX shop_follows_seller ON shop_follows(seller_id);
    ALTER TABLE feed_pages ADD COLUMN reasons JSONB NOT NULL DEFAULT '{}';
    REVOKE ALL ON shop_follows FROM PUBLIC;
    INSERT INTO swipe.schema_migrations(version) VALUES ('004_follows_reasons.sql');
  END IF;
END
$swipe_migration$;

-- 005_likes.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '005_likes.sql') THEN
    SET search_path TO swipe, public, extensions;
    CREATE TABLE product_likes (
     actor_id TEXT NOT NULL REFERENCES feed_actors(id) ON DELETE CASCADE,
     product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY(actor_id,product_id)
    );
    CREATE INDEX product_likes_product ON product_likes(product_id);
    CREATE TABLE like_imports (
     id UUID PRIMARY KEY,
     actor_id TEXT NOT NULL REFERENCES feed_actors(id),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    REVOKE ALL ON product_likes,like_imports FROM PUBLIC;
    INSERT INTO swipe.schema_migrations(version) VALUES ('005_likes.sql');
  END IF;
END
$swipe_migration$;

-- 006_admin.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '006_admin.sql') THEN
    SET search_path TO swipe, public, extensions;
    CREATE TABLE admin_roles (user_id TEXT PRIMARY KEY REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE account_moderation (user_id TEXT PRIMARY KEY REFERENCES users(id), suspended BOOLEAN NOT NULL DEFAULT false, reason TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE product_moderation (product_id TEXT PRIMARY KEY REFERENCES products(id), hidden BOOLEAN NOT NULL DEFAULT false, reason TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE admin_audit (id UUID PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX admin_audit_time ON admin_audit(created_at DESC);
    REVOKE ALL ON admin_roles,account_moderation,product_moderation,admin_audit FROM PUBLIC;
    INSERT INTO swipe.schema_migrations(version) VALUES ('006_admin.sql');
  END IF;
END
$swipe_migration$;

-- 007_account_security.sql
DO $swipe_migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM swipe.schema_migrations WHERE version = '007_account_security.sql') THEN
    SET search_path TO swipe, public, extensions;
    CREATE TABLE IF NOT EXISTS account_verifications (
     user_id TEXT PRIMARY KEY REFERENCES users(id),
     email TEXT NOT NULL,
     verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS account_tokens (
     hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     email TEXT NOT NULL,
     purpose TEXT NOT NULL CHECK (purpose IN ('reset','verify')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at TIMESTAMPTZ NOT NULL,
     consumed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS account_tokens_owner ON account_tokens(user_id,purpose,created_at);
    REVOKE ALL ON account_verifications, account_tokens FROM PUBLIC;
    INSERT INTO swipe.schema_migrations(version) VALUES ('007_account_security.sql');
  END IF;
END
$swipe_migration$;

COMMIT;

-- Başarılı kurulumda uygulanmış migration listesini gösterir.
SELECT version, applied_at FROM swipe.schema_migrations ORDER BY version;
