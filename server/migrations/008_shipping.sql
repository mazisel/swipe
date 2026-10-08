SET search_path TO swipe, public, extensions;
CREATE TABLE IF NOT EXISTS order_shipping (
 order_id TEXT PRIMARY KEY REFERENCES orders(id),
 status TEXT NOT NULL CHECK(status IN ('preparing','shipped','out_for_delivery','delivered','returned')),
 carrier TEXT NOT NULL DEFAULT '',
 tracking_number TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON order_shipping FROM PUBLIC;
