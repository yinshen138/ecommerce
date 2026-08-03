-- Deterministic seed for PostgreSQL integration workflow.
BEGIN;

INSERT INTO categories (id, name, slug, sort_order)
VALUES ('10000000-0000-0000-0000-000000000001', 'CI 分类', 'ci-default', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, title, description, sku, price_cents, list_price_cents, status, category_id)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'CI 示例商品',
  '用于 PostgreSQL 集成测试',
  'SKU-CI-001',
  1999,
  2499,
  'published',
  '10000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, sku, title, attrs, price_cents, list_price_cents)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'VAR-CI-001',
  '默认规格',
  '{"spec":"default"}'::jsonb,
  1999,
  2499
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory (variant_id, available, reserved)
VALUES ('00000000-0000-0000-0000-000000000001', 100, 0)
ON CONFLICT (variant_id) DO UPDATE SET available = EXCLUDED.available, reserved = EXCLUDED.reserved;

COMMIT;
