SET search_path TO swipe, public, extensions;
CREATE TABLE IF NOT EXISTS media_assets (url TEXT PRIMARY KEY REFERENCES uploads(url), content_hash TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes>0));
REVOKE ALL ON TABLE media_assets FROM PUBLIC;
