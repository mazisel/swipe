SET search_path TO swipe, public, extensions;
CREATE TABLE dm_blocks (
 blocker_id TEXT NOT NULL REFERENCES users(id), blocked_id TEXT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);
CREATE TABLE reports (
 id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('product','shop','message')), target_id TEXT NOT NULL,
 target_user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL,
 snapshot JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
 resolution TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reports_active ON reports(reporter_id,kind,target_id) WHERE status IN ('open','reviewing');
CREATE TABLE notifications (
 id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 event_key TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('message','shipping','product')),
 title TEXT NOT NULL, route TEXT NOT NULL, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,event_key)
);
CREATE INDEX notifications_owner ON notifications(user_id,id DESC);
CREATE TABLE order_shipments (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), seller_id TEXT NOT NULL, shop TEXT NOT NULL,
 items JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'preparing', carrier TEXT NOT NULL DEFAULT '', tracking_number TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ,
 UNIQUE(order_id,seller_id), CHECK(status IN ('preparing','shipped','out_for_delivery','delivered','returned'))
);
-- Historical seller names and items stay as purchased. Unknown legacy sellers
-- are grouped by their saved shop name, never assigned to a different shop.
WITH grouped AS (
 SELECT o.id AS order_id,COALESCE(i->>'sellerId',p.seller_id,'legacy:'||md5(COALESCE(i->>'shop','Mağaza'))) AS seller_id,
 min(COALESCE(i->>'shop','Mağaza')) AS shop,jsonb_agg(i) AS items
 FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.data::jsonb->'items') i LEFT JOIN products p ON p.id=i->>'productId'
 GROUP BY o.id,COALESCE(i->>'sellerId',p.seller_id,'legacy:'||md5(COALESCE(i->>'shop','Mağaza')))
), counted AS (SELECT *,count(*) OVER(PARTITION BY order_id) AS shops FROM grouped)
INSERT INTO order_shipments(id,order_id,seller_id,shop,items,status,carrier,tracking_number,version,updated_at)
SELECT md5(g.order_id||':'||g.seller_id),g.order_id,g.seller_id,g.shop,g.items,
 CASE WHEN g.shops=1 THEN COALESCE(s.status,'preparing') ELSE 'preparing' END,
 CASE WHEN g.shops=1 THEN COALESCE(s.carrier,'') ELSE '' END,
 CASE WHEN g.shops=1 THEN COALESCE(s.tracking_number,'') ELSE '' END,
 CASE WHEN g.shops=1 THEN COALESCE(s.version,0) ELSE 0 END,
 CASE WHEN g.shops=1 THEN s.updated_at ELSE NULL END
FROM counted g LEFT JOIN order_shipping s ON s.order_id=g.order_id;
REVOKE ALL ON dm_blocks,reports,notifications,order_shipments FROM PUBLIC;
REVOKE ALL ON SEQUENCE notifications_id_seq FROM PUBLIC;
