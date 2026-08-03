const crypto = require('crypto')
const { query } = require('../db_adapter')

const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'

function nowStr() {
  return new Date().toISOString().replace('T', ' ').split('.')[0]
}

function q(isSqlite, sqliteSql, pgSql, params) {
  return query(isSqlite ? sqliteSql : pgSql, params)
}

async function calculatePricing(isSqlite, items, couponCode, isFlashSale) {
  if (items.length === 0) return { error: 'empty_items', status: 400 }
  if (couponCode && isFlashSale) return { error: 'coupon_conflicts_flash_sale', status: 400 }

  const details = []
  let subtotal = 0
  for (const raw of items) {
    const variantId = raw.variant_id
    const qty = Number(raw.qty)
    if (!variantId || !Number.isInteger(qty) || qty <= 0) return { error: 'invalid_item_payload', status: 400 }
    const variantRes = await q(
      isSqlite,
      `SELECT v.id, v.sku, v.title, COALESCE(v.price_cents, p.price_cents) AS unit_price_cents, p.title AS product_title
       FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?`,
      `SELECT v.id, v.sku, v.title, COALESCE(v.price_cents, p.price_cents) AS unit_price_cents, p.title AS product_title
       FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = $1`,
      [variantId]
    )
    const variant = variantRes.rows && variantRes.rows[0]
    if (!variant) return { error: 'variant_not_found', status: 404, variant_id: variantId }
    const line_total_cents = Number(variant.unit_price_cents) * qty
    subtotal += line_total_cents
    details.push({
      variant_id: variant.id,
      sku: variant.sku,
      title: variant.title || variant.product_title,
      unit_price_cents: Number(variant.unit_price_cents),
      qty,
      line_total_cents
    })
  }

  let discount_cents = 0
  let coupon = null
  if (couponCode) {
    const couponRes = await q(
      isSqlite,
      `SELECT id, code, discount_cents, percent_off, starts_at, expires_at FROM coupons WHERE code = ? LIMIT 1`,
      `SELECT id, code, discount_cents, percent_off, starts_at, expires_at FROM coupons WHERE code = $1 LIMIT 1`,
      [couponCode]
    )
    coupon = couponRes.rows && couponRes.rows[0]
    if (!coupon) return { error: 'invalid_coupon', status: 400 }
    const now = Date.now()
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return { error: 'coupon_not_started', status: 400 }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return { error: 'coupon_expired', status: 400 }
    if (coupon.percent_off) discount_cents = Math.floor(subtotal * (Number(coupon.percent_off) / 100))
    if (coupon.discount_cents) discount_cents = Math.max(discount_cents, Number(coupon.discount_cents))
    if (discount_cents > subtotal) discount_cents = subtotal
  }

  const shipping_cents = subtotal >= 5000 ? 0 : 800
  const total_cents = Math.max(0, subtotal + shipping_cents - discount_cents)
  return {
    data: {
      items: details,
      subtotal_cents: subtotal,
      shipping_cents,
      discount_cents,
      total_cents,
      coupon: coupon ? { id: coupon.id, code: coupon.code } : null
    }
  }
}

module.exports = function attachOrderRoutes(app) {
  if (USE_FAKE_DB) {
    const orders = new Map()
    const orderItems = new Map()

    app.post('/api/checkout/preview', (req, res) => {
      const items = Array.isArray(req.body.items) ? req.body.items : []
      if (items.length === 0) return res.status(400).json({ error: 'empty_items' })
      const subtotal = items.reduce((acc, it) => acc + (Number(it.qty) || 0) * 1999, 0)
      const shipping_cents = subtotal >= 5000 ? 0 : 800
      return res.json({
        subtotal_cents: subtotal,
        shipping_cents,
        discount_cents: 0,
        total_cents: subtotal + shipping_cents
      })
    })

    app.post('/api/orders', (req, res) => {
      const items = Array.isArray(req.body.items) ? req.body.items : []
      if (items.length === 0) return res.status(400).json({ error: 'empty_items' })
      if (req.body.coupon_code && req.body.is_flash_sale) return res.status(400).json({ error: 'coupon_conflicts_flash_sale' })
      const id = crypto.randomUUID()
      const subtotal = items.reduce((acc, it) => acc + (Number(it.qty) || 0) * 1999, 0)
      const shipping_cents = subtotal >= 5000 ? 0 : 800
      const total_cents = subtotal + shipping_cents
      const order = {
        id,
        user_id: null,
        status: 'created',
        total_cents,
        shipping_cents,
        discount_cents: 0,
        address_id: req.body.address_id || null,
        coupon_id: null,
        created_at: nowStr(),
        updated_at: nowStr(),
        paid_at: null
      }
      orders.set(id, order)
      orderItems.set(id, items.map((it) => ({
        id: crypto.randomUUID(),
        order_id: id,
        variant_id: it.variant_id,
        sku: null,
        title: null,
        unit_price_cents: 1999,
        qty: Number(it.qty) || 1
      })))
      const pay_before = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      return res.status(201).json({ order, items: orderItems.get(id), pay_before })
    })

    app.get('/api/orders/:id', (req, res) => {
      const order = orders.get(req.params.id)
      if (!order) return res.status(404).json({ error: 'not_found' })
      return res.json({ order, items: orderItems.get(order.id) || [] })
    })

    app.post('/api/orders/:id/cancel', (req, res) => {
      const order = orders.get(req.params.id)
      if (!order) return res.status(404).json({ error: 'not_found' })
      if (order.status !== 'created') return res.status(409).json({ error: 'invalid_status_transition', current_status: order.status })
      order.status = 'cancelled'
      order.updated_at = nowStr()
      return res.json({ success: true, order_id: order.id, status: 'cancelled' })
    })

    return
  }

  app.post('/api/checkout/preview', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const items = Array.isArray(req.body.items) ? req.body.items : []
    const couponCode = req.body.coupon_code
    const isFlashSale = !!req.body.is_flash_sale

    try {
      const priced = await calculatePricing(isSqlite, items, couponCode, isFlashSale)
      if (priced.error) return res.status(priced.status || 400).json(priced)
      return res.json(priced.data)
    } catch (err) {
      console.error('Error previewing checkout', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/orders', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const items = Array.isArray(req.body.items) ? req.body.items : []
    const addressId = req.body.address_id || null
    const couponCode = req.body.coupon_code
    const isFlashSale = !!req.body.is_flash_sale

    const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'
    const commitSql = 'COMMIT'
    const rollbackSql = 'ROLLBACK'
    const orderId = crypto.randomUUID()

    try {
      await query(beginSql)
      const pricedResult = await calculatePricing(isSqlite, items, couponCode, isFlashSale)
      if (pricedResult.error || !pricedResult.data) {
        await query(rollbackSql)
        return res.status(pricedResult.status || 400).json(pricedResult)
      }
      const priced = pricedResult.data

      for (const line of priced.items) {
        const invRes = await q(
          isSqlite,
          'SELECT variant_id, available, reserved FROM inventory WHERE variant_id = ?',
          'SELECT variant_id, available, reserved FROM inventory WHERE variant_id = $1 FOR UPDATE',
          [line.variant_id]
        )
        const inv = invRes.rows && invRes.rows[0]
        if (!inv) {
          await query(rollbackSql)
          return res.status(409).json({ error: 'inventory_not_found', variant_id: line.variant_id })
        }
        if (Number(inv.available) < Number(line.qty)) {
          await query(rollbackSql)
          return res.status(409).json({ error: 'insufficient_inventory', variant_id: line.variant_id, available: Number(inv.available) })
        }
      }

      const couponId = priced.coupon ? priced.coupon.id : null
      const userId = req.user && req.user.profile && req.user.profile.id ? req.user.profile.id : null

      await q(
        isSqlite,
        `INSERT INTO orders (id, user_id, status, total_cents, shipping_cents, discount_cents, address_id, coupon_id, created_at, updated_at)
         VALUES (?, ?, 'created', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        `INSERT INTO orders (id, user_id, status, total_cents, shipping_cents, discount_cents, address_id, coupon_id)
         VALUES ($1, $2, 'created', $3, $4, $5, $6, $7)`,
        [orderId, userId, priced.total_cents, priced.shipping_cents, priced.discount_cents, addressId, couponId]
      )

      for (const line of priced.items) {
        const itemId = crypto.randomUUID()
        await q(
          isSqlite,
          `INSERT INTO order_items (id, order_id, variant_id, sku, title, unit_price_cents, qty)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          `INSERT INTO order_items (id, order_id, variant_id, sku, title, unit_price_cents, qty)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [itemId, orderId, line.variant_id, line.sku || null, line.title || null, line.unit_price_cents, line.qty]
        )
        await q(
          isSqlite,
          `UPDATE inventory SET available = available - ?, reserved = reserved + ?, updated_at = datetime('now') WHERE variant_id = ?`,
          `UPDATE inventory SET available = available - $1, reserved = reserved + $1, updated_at = now() WHERE variant_id = $2`,
          [line.qty, line.qty, line.variant_id]
        )
        await q(
          isSqlite,
          `INSERT INTO inventory_locks (id, order_id, variant_id, qty, locked_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          `INSERT INTO inventory_locks (id, order_id, variant_id, qty) VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), orderId, line.variant_id, line.qty]
        )
      }

      await q(
        isSqlite,
        `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, 'created', 'order created', datetime('now'))`,
        `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, 'created', 'order created')`,
        [crypto.randomUUID(), orderId]
      )

      await query(commitSql)
      const pay_before = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      return res.status(201).json({
        order_id: orderId,
        status: 'created',
        total_cents: priced.total_cents,
        pay_before
      })
    } catch (err) {
      try { await query(rollbackSql) } catch (_) {}
      console.error('Error creating order', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.get('/api/orders/:id', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const orderId = req.params.id
    try {
      const orderRes = await q(
        isSqlite,
        `SELECT * FROM orders WHERE id = ?`,
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
      )
      const order = orderRes.rows && orderRes.rows[0]
      if (!order) return res.status(404).json({ error: 'not_found' })

      const itemsRes = await q(
        isSqlite,
        `SELECT * FROM order_items WHERE order_id = ?`,
        `SELECT * FROM order_items WHERE order_id = $1`,
        [orderId]
      )
      return res.json({ order, items: itemsRes.rows || [] })
    } catch (err) {
      console.error('Error fetching order detail', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.get('/api/orders', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const status = req.query.status
    const userId = req.query.user_id
    try {
      let rows
      if (status && userId) {
        rows = await q(
          isSqlite,
          `SELECT * FROM orders WHERE status = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100`,
          `SELECT * FROM orders WHERE status = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 100`,
          [status, userId]
        )
      } else if (status) {
        rows = await q(
          isSqlite,
          `SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 100`,
          `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT 100`,
          [status]
        )
      } else if (userId) {
        rows = await q(
          isSqlite,
          `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
          `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [userId]
        )
      } else {
        rows = await q(
          isSqlite,
          `SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`,
          `SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`,
          []
        )
      }
      return res.json({ orders: rows.rows || [] })
    } catch (err) {
      console.error('Error listing orders', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/orders/:id/cancel', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const orderId = req.params.id
    try {
      const cancelResult = await cancelCreatedOrder(isSqlite, orderId, req.body.reason || 'user_cancelled')
      if (cancelResult.error === 'not_found') return res.status(404).json({ error: 'not_found' })
      if (cancelResult.error === 'invalid_status_transition') {
        return res.status(409).json({ error: 'invalid_status_transition', current_status: cancelResult.current_status })
      }
      return res.json({ success: true, order_id: orderId, status: 'cancelled' })
    } catch (err) {
      console.error('Error cancelling order', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/orders/release-expired', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const timeoutMinutes = Number(req.body.timeout_minutes) > 0 ? Number(req.body.timeout_minutes) : 15
    try {
      const expiredRes = await q(
        isSqlite,
        `SELECT id FROM orders WHERE status = 'created' AND created_at <= datetime('now', ?)`,
        `SELECT id FROM orders WHERE status = 'created' AND created_at <= (now() - ($1 || ' minutes')::interval)`,
        [`-${timeoutMinutes} minutes`, String(timeoutMinutes)]
      )
      const orderIds = (expiredRes.rows || []).map((r) => r.id)
      let released = 0
      for (const id of orderIds) {
        const result = await cancelCreatedOrder(isSqlite, id, 'expired_unpaid_auto_cancel')
        if (!result.error) released += 1
      }
      return res.json({ success: true, checked: orderIds.length, released })
    } catch (err) {
      console.error('Error releasing expired orders', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}

async function cancelCreatedOrder(isSqlite, orderId, reason) {
  const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'
  await query(beginSql)
  try {
    const orderRes = await q(
      isSqlite,
      `SELECT * FROM orders WHERE id = ?`,
      `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    )
    const order = orderRes.rows && orderRes.rows[0]
    if (!order) {
      await query('ROLLBACK')
      return { error: 'not_found' }
    }
    if (order.status !== 'created') {
      await query('ROLLBACK')
      return { error: 'invalid_status_transition', current_status: order.status }
    }

    const itemsRes = await q(
      isSqlite,
      `SELECT variant_id, qty FROM order_items WHERE order_id = ?`,
      `SELECT variant_id, qty FROM order_items WHERE order_id = $1`,
      [orderId]
    )
    for (const item of (itemsRes.rows || [])) {
      await q(
        isSqlite,
        `UPDATE inventory SET available = available + ?, reserved = CASE WHEN reserved - ? < 0 THEN 0 ELSE reserved - ? END, updated_at = datetime('now') WHERE variant_id = ?`,
        `UPDATE inventory SET available = available + $1, reserved = GREATEST(0, reserved - $1), updated_at = now() WHERE variant_id = $2`,
        [item.qty, item.qty, item.qty, item.variant_id]
      )
    }

    await q(
      isSqlite,
      `UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`,
      `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`,
      [orderId]
    )
    await q(
      isSqlite,
      `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, 'cancelled', ?, datetime('now'))`,
      `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, 'cancelled', $3)`,
      [crypto.randomUUID(), orderId, reason]
    )
    await query('COMMIT')
    return { ok: true }
  } catch (err) {
    try { await query('ROLLBACK') } catch (_) {}
    throw err
  }
}
