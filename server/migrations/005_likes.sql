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
