CREATE TABLE IF NOT EXISTS portfolio_items (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS portfolio_items_order
  ON portfolio_items (collection, sort_order);

CREATE TABLE IF NOT EXISTS portfolio_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expiry
  ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  address_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
