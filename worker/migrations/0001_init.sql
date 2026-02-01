-- D1 (SQLite) schema for MVP.

CREATE TABLE IF NOT EXISTS pointers (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,        -- sample | preview
  source_key TEXT NOT NULL,  -- unique-ish key (idempotency)
  data_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_source_key
  ON snapshots(source_key);

CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  kind TEXT NOT NULL,        -- sample | preview | master
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  width_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  FOREIGN KEY(snapshot_id) REFERENCES snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_artworks_snapshot_id
  ON artworks(snapshot_id);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,       -- DRAFT | PAID | SUBMITTED | SHIPPED | CANCELED | FAILED
  artwork_id TEXT NOT NULL,
  stripe_session_id TEXT,
  customer_email TEXT,
  shipping_json TEXT,
  pod_provider TEXT,
  pod_order_id TEXT,
  last_error TEXT,
  FOREIGN KEY(artwork_id) REFERENCES artworks(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);
