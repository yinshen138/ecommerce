require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authMiddleware } = require('./supabaseAuth');
const { query } = require('./db_adapter')

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// attach auth middleware (adds req.user when Authorization: Bearer <token> present)
app.use(authMiddleware());

// attach cart routes
require('./routes/cart')(app);
require('./routes/orders')(app);
require('./routes/payments')(app);
require('./routes/admin')(app);
require('./routes/addresses')(app);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// current user
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' })
  return res.json({ user: req.user })
})

// products list using DB (supports search, filters, sort)
app.get('/api/products', async (req, res) => {
  try {
    const isSqlite = !process.env.DATABASE_URL
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : null
    const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : null
    const minPrice = typeof req.query.min_price === 'string' && req.query.min_price !== '' ? Number(req.query.min_price) : null
    const maxPrice = typeof req.query.max_price === 'string' && req.query.max_price !== '' ? Number(req.query.max_price) : null
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest'
    const limit = Math.min(100, Number(req.query.limit) || 50)
    const page = Math.max(0, Number(req.query.page) || 0)

    const where = ["p.status = 'published'"]
    const params = []

    if (q) {
      if (isSqlite) { where.push('(p.title LIKE ? OR p.description LIKE ?)'); params.push('%' + q + '%', '%' + q + '%') }
      else { where.push('(p.title ILIKE $' + (params.length + 1) + ' OR p.description ILIKE $' + (params.length + 2) + ')'); params.push('%' + q + '%', '%' + q + '%') }
    }
    if (category) {
      if (isSqlite) { where.push('p.category = ?'); params.push(category) }
      else { where.push('p.category = $' + (params.length + 1)); params.push(category) }
    }
    if (minPrice !== null) {
      if (isSqlite) { where.push('p.price_cents >= ?'); params.push(Math.floor(minPrice)) }
      else { where.push('p.price_cents >= $' + (params.length + 1)); params.push(Math.floor(minPrice)) }
    }
    if (maxPrice !== null) {
      if (isSqlite) { where.push('p.price_cents <= ?'); params.push(Math.floor(maxPrice)) }
      else { where.push('p.price_cents <= $' + (params.length + 1)); params.push(Math.floor(maxPrice)) }
    }

    let orderBy = 'p.created_at DESC'
    if (sort === 'price_asc') orderBy = 'p.price_cents ASC'
    else if (sort === 'price_desc') orderBy = 'p.price_cents DESC'

    let sql
    if (isSqlite) {
      sql = `SELECT p.id, p.title, p.description, p.price_cents, p.list_price_cents, p.status FROM products p WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${page * limit}`
    } else {
      // need to use $n param indexes already in params; OFFSET and LIMIT as literals safe when numbers
      sql = `SELECT p.id, p.title, p.description, p.price_cents, p.list_price_cents, p.status FROM products p WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${page * limit}`
    }

    const result = await query(sql, params)
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