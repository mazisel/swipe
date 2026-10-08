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
