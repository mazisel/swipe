SET search_path TO swipe, public, extensions;
-- Existing clients retain 20-item sessions; the app opts into six-item windows.
ALTER TABLE feed_sessions ADD COLUMN page_size INTEGER NOT NULL DEFAULT 20 CHECK (page_size IN (6,20));
CREATE INDEX feed_impressions_actor_time ON feed_impressions(actor_id,created_at DESC);
