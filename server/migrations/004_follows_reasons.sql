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
