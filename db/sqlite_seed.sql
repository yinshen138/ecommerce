-- Seed minimal data into SQLite DB for testing
INSERT OR IGNORE INTO products (id, title, description, sku, price_cents, list_price_cents, status) VALUES
('prod-1', '示例商品-SQLite', 'SQLite 环境下的示例商品', 'SKU-SQL-001', 1999, 2499, 'published');

INSERT OR IGNORE INTO product_variants (id, product_id, sku, title, attrs, price_cents) VALUES
('var-1', 'prod-1', 'SKU-SQL-001A', '默认规格', '{"color":"red"}', 1999);

INSERT OR IGNORE INTO inventory (variant_id, available, reserved) VALUES
('var-1', 100, 0);

INSERT OR IGNORE INTO coupons (id, code, description, discount_cents, percent_off, starts_at, expires_at, limit_per_user) VALUES
('coupon-1', 'WELCOME10', '新用户满减', 0, 10, datetime('now', '-1 day'), datetime('now', '+30 day'), 1);
