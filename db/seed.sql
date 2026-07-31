-- Seed sample data for local development
-- Run with: psql $DATABASE_URL -f seed.sql

-- create a sample category
INSERT INTO categories (id, name, slug, sort_order)
VALUES (gen_random_uuid(), '默认分类', 'default', 0)
ON CONFLICT DO NOTHING;

-- sample product
INSERT INTO products (id, title, description, sku, price_cents, list_price_cents, status)
VALUES (gen_random_uuid(), '示例商品', '这是一个示例商品。', 'SKU-EX-001', 1999, 2499, 'published')
ON CONFLICT DO NOTHING;

-- To insert variants and inventory, query product id and insert product_variants/inventory rows.
