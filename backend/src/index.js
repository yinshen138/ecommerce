require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authMiddleware } = require('./supabaseAuth');
const { query } = require('./db_adapter')

const app = express();
app.use(cors());
app.use(express.json());

// attach auth middleware (adds req.user when Authorization: Bearer <token> present)
app.use(authMiddleware());

// attach cart routes
require('./routes/cart')(app);
require('./routes/orders')(app);
require('./routes/payments')(app);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// current user
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' })
  return res.json({ user: req.user })
})

// products list using DB (simple)
app.get('/api/products', async (req, res) => {
  try {
    const sql = "SELECT p.id, p.title, p.description, p.price_cents, p.list_price_cents, p.status FROM products p WHERE p.status = 'published' ORDER BY p.created_at DESC LIMIT 50"
    const result = await query(sql)
    return res.json({ products: result.rows })
  } catch (err) {
    console.error('Error fetching products', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// product detail
app.get('/api/products/:id', async (req, res) => {
  const id = req.params.id
  const isSqlite = !process.env.DATABASE_URL
  try {
    let productResult
    if (isSqlite) {
      productResult = await query('SELECT id, title, description, price_cents, list_price_cents, status FROM products WHERE id = ?', [id])
    } else {
      productResult = await query('SELECT id, title, description, price_cents, list_price_cents, status FROM products WHERE id = $1', [id])
    }
    const product = productResult.rows && productResult.rows[0]
    if (!product) { console.log('Product not found for id', id, 'productResult rows:', productResult.rows); return res.status(404).json({ error: 'not_found' }) }

    // fetch variants and inventory for product
    let variantsSql, variantsRes
    if (isSqlite) {
      variantsSql = `SELECT v.id, v.sku, v.title, v.attrs, v.price_cents, i.available, i.reserved FROM product_variants v LEFT JOIN inventory i ON v.id = i.variant_id WHERE v.product_id = ?`
      variantsRes = await query(variantsSql, [id])
    } else {
      variantsSql = `SELECT v.id, v.sku, v.title, v.attrs, v.price_cents, COALESCE(i.available,0) as available, COALESCE(i.reserved,0) as reserved FROM product_variants v LEFT JOIN inventory i ON v.id = i.variant_id WHERE v.product_id = $1`
      variantsRes = await query(variantsSql, [id])
    }

    return res.json({ product, variants: variantsRes.rows })
  } catch (err) {
    console.error('Error fetching product detail', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API server listening on ${port}`));