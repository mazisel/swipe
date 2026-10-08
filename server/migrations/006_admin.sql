SET search_path TO swipe, public, extensions;
CREATE TABLE admin_roles (user_id TEXT PRIMARY KEY REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE account_moderation (user_id TEXT PRIMARY KEY REFERENCES users(id), suspended BOOLEAN NOT NULL DEFAULT false, reason TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE product_moderation (product_id TEXT PRIMARY KEY REFERENCES products(id), hidden BOOLEAN NOT NULL DEFAULT false, reason TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE admin_audit (id UUID PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX admin_audit_time ON admin_audit(created_at DESC);
REVOKE ALL ON admin_roles,account_moderation,product_moderation,admin_audit FROM PUBLIC;
