-- Simplified SQLite schema for local testing (not full parity with Postgres schema)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  price_cents INTEGER NOT NULL,
  list_price_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  sku TEXT UNIQUE,
  title TEXT,
  attrs TEXT,
  price_cents INTEGER,
  list_price_cents INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  variant_id TEXT PRIMARY KEY,
  available INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

-- Carts and cart items for local testing
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT,
  variant_id TEXT,
  qty INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY(variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);
