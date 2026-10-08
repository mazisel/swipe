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
