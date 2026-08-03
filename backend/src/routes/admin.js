const crypto = require('crypto')
const { query } = require('../db_adapter')

const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'

function q(isSqlite, sqliteSql, pgSql, params) {
  return query(isSqlite ? sqliteSql : pgSql, params)
}

module.exports = function attachAdminRoutes(app) {
  if (USE_FAKE_DB) {
    const refunds = new Map()

    app.get('/api/admin/orders', (_req, res) => res.json({ orders: [] }))
    app.post('/api/admin/orders/:id/ship', (req, res) => {
      return res.json({ success: true, order_id: req.params.id, status: 'shipped', note: 'fake_db_mode' })
    })

    app.post('/api/orders/:id/refunds', (req, res) => {
      const id = crypto.randomUUID()
      const refund = {
        id,
        order_id: req.params.id,
        amount_cents: Number(req.body.amount_cents) || 0,
        reason: req.body.reason || '',
        status: 'requested',
        processed_at: null
      }
      refunds.set(id, refund)
      return res.status(201).json({ refund })
    })

    app.get('/api/admin/refunds', (_req, res) => {
      return res.json({ refunds: Array.from(refunds.values()) })
    })

    app.post('/api/admin/refunds/:id/review', (req, res) => {
      const refund = refunds.get(req.params.id)
      if (!refund) return res.status(404).json({ error: 'refund_not_found' })
      const action = req.body.action
      if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'invalid_action' })
      if (action === 'approve') {
        refund.status = 'processed'
        refund.processed_at = new Date().toISOString()
      } else {
        refund.status = 'rejected'
      }
      return res.json({ success: true, refund })
    })

    return
  }

  app.get('/api/admin/orders', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const status = req.query.status
    try {
      let rows
      if (status) {
        rows = await q(
          isSqlite,
          `SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200`,
          `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT 200`,
          [status]
        )
      } else {
        rows = await q(
          isSqlite,
          `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`,
          `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`,
          []
        )
      }
      return res.json({ orders: rows.rows || [] })
    } catch (err) {
      console.error('Error listing admin orders', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/admin/orders/:id/ship', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const orderId = req.params.id
    const trackingNo = req.body.tracking_no || null
    const carrier = req.body.carrier || null
    const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'

    try {
      await query(beginSql)
      const orderRes = await q(
        isSqlite,
        `SELECT * FROM orders WHERE id = ?`,
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      )
      const order = orderRes.rows && orderRes.rows[0]
      if (!order) {
        await query('ROLLBACK')
        return res.status(404).json({ error: 'not_found' })
      }
      if (order.status !== 'paid') {
        await query('ROLLBACK')
        return res.status(409).json({ error: 'invalid_status_transition', current_status: order.status })
      }

      await q(
        isSqlite,
        `UPDATE orders SET status = 'shipped', updated_at = datetime('now') WHERE id = ?`,
        `UPDATE orders SET status = 'shipped', updated_at = now() WHERE id = $1`,
        [orderId]
      )
      const note = trackingNo || carrier ? `order shipped carrier=${carrier || '-'} tracking=${trackingNo || '-'}` : 'order shipped'
      await q(
        isSqlite,
        `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, 'shipped', ?, datetime('now'))`,
        `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, 'shipped', $3)`,
        [crypto.randomUUID(), orderId, note]
      )
      await query('COMMIT')
      return res.json({ success: true, order_id: orderId, status: 'shipped', carrier, tracking_no: trackingNo })
    } catch (err) {
      try { await query('ROLLBACK') } catch (_) {}
      console.error('Error shipping order', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/orders/:id/refunds', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const orderId = req.params.id
    const reason = req.body.reason || ''
    const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'
    try {
      await query(beginSql)
      const orderRes = await q(
        isSqlite,
        `SELECT * FROM orders WHERE id = ?`,
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      )
      const order = orderRes.rows && orderRes.rows[0]
      if (!order) {
        await query('ROLLBACK')
        return res.status(404).json({ error: 'order_not_found' })
      }
      if (!['paid', 'shipped', 'completed'].includes(order.status)) {
        await query('ROLLBACK')
        return res.status(409).json({ error: 'order_not_refundable', current_status: order.status })
      }

      const openRefundRes = await q(
        isSqlite,
        `SELECT id FROM refunds WHERE order_id = ? AND status IN ('requested','approved','processed') LIMIT 1`,
        `SELECT id FROM refunds WHERE order_id = $1 AND status IN ('requested','approved','processed') LIMIT 1`,
        [orderId]
      )
      if (openRefundRes.rows && openRefundRes.rows[0]) {
        await query('ROLLBACK')
        return res.status(409).json({ error: 'refund_already_exists' })
      }

      const amountCents = Number(req.body.amount_cents) > 0 ? Number(req.body.amount_cents) : Number(order.total_cents)
      if (amountCents > Number(order.total_cents)) {
        await query('ROLLBACK')
        return res.status(400).json({ error: 'refund_amount_exceeds_paid' })
      }

      const refundId = crypto.randomUUID()
      await q(
        isSqlite,
        `INSERT INTO refunds (id, order_id, amount_cents, reason, status, processed_at) VALUES (?, ?, ?, ?, 'requested', NULL)`,
        `INSERT INTO refunds (id, order_id, amount_cents, reason, status, processed_at) VALUES ($1, $2, $3, $4, 'requested', NULL)`,
        [refundId, orderId, amountCents, reason]
      )
      await q(
        isSqlite,
        `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
        `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, $3, $4)`,
        [crypto.randomUUID(), orderId, order.status, `refund requested amount=${amountCents}`]
      )
      await query('COMMIT')
      return res.status(201).json({ refund_id: refundId, order_id: orderId, amount_cents: amountCents, status: 'requested' })
    } catch (err) {
      try { await query('ROLLBACK') } catch (_) {}
      console.error('Error requesting refund', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.get('/api/admin/refunds', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const status = req.query.status
    try {
      let rows
      if (status) {
        rows = await q(
          isSqlite,
          `SELECT r.*, o.status AS order_status, o.total_cents AS order_total_cents
           FROM refunds r LEFT JOIN orders o ON o.id = r.order_id
           WHERE r.status = ? ORDER BY r.rowid DESC LIMIT 200`,
          `SELECT r.*, o.status AS order_status, o.total_cents AS order_total_cents
           FROM refunds r LEFT JOIN orders o ON o.id = r.order_id
           WHERE r.status = $1 ORDER BY r.created_at DESC NULLS LAST LIMIT 200`,
          [status]
        )
      } else {
        rows = await q(
          isSqlite,
          `SELECT r.*, o.status AS order_status, o.total_cents AS order_total_cents
           FROM refunds r LEFT JOIN orders o ON o.id = r.order_id
           ORDER BY r.rowid DESC LIMIT 200`,
          `SELECT r.*, o.status AS order_status, o.total_cents AS order_total_cents
           FROM refunds r LEFT JOIN orders o ON o.id = r.order_id
           ORDER BY r.created_at DESC NULLS LAST LIMIT 200`,
          []
        )
      }
      return res.json({ refunds: rows.rows || [] })
    } catch (err) {
      console.error('Error listing refunds', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/admin/refunds/:id/review', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const refundId = req.params.id
    const action = req.body.action
    const note = req.body.note || ''
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'invalid_action' })

    const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'
    try {
      await query(beginSql)
      const refundRes = await q(
        isSqlite,
        `SELECT * FROM refunds WHERE id = ?`,
        `SELECT * FROM refunds WHERE id = $1 FOR UPDATE`,
        [refundId]
      )
      const refund = refundRes.rows && refundRes.rows[0]
      if (!refund) {
        await query('ROLLBACK')
        return res.status(404).json({ error: 'refund_not_found' })
      }
      if (refund.status !== 'requested') {
        await query('ROLLBACK')
        return res.status(409).json({ error: 'refund_not_reviewable', current_status: refund.status })
      }

      if (action === 'approve') {
        await q(
          isSqlite,
          `UPDATE refunds SET status = 'processed', processed_at = datetime('now') WHERE id = ?`,
          `UPDATE refunds SET status = 'processed', processed_at = now() WHERE id = $1`,
          [refundId]
        )
        await q(
          isSqlite,
          `UPDATE orders SET status = 'refunded', updated_at = datetime('now') WHERE id = ?`,
          `UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = $1`,
          [refund.order_id]
        )
        await q(
          isSqlite,
          `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, 'refunded', ?, datetime('now'))`,
          `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, 'refunded', $3)`,
          [crypto.randomUUID(), refund.order_id, `refund approved and processed${note ? `: ${note}` : ''}`]
        )
      } else {
        await q(
          isSqlite,
          `UPDATE refunds SET status = 'rejected' WHERE id = ?`,
          `UPDATE refunds SET status = 'rejected' WHERE id = $1`,
          [refundId]
        )
        await q(
          isSqlite,
          `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
          `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, $3, $4)`,
          [crypto.randomUUID(), refund.order_id, 'refund_rejected', note || 'refund rejected by admin']
        )
      }

      await query('COMMIT')
      return res.json({ success: true, refund_id: refundId, status: action === 'approve' ? 'processed' : 'rejected' })
    } catch (err) {
      try { await query('ROLLBACK') } catch (_) {}
      console.error('Error reviewing refund', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}
