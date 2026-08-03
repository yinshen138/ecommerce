const crypto = require('crypto')
const { query } = require('../db_adapter')

const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'

function q(isSqlite, sqliteSql, pgSql, params) {
  return query(isSqlite ? sqliteSql : pgSql, params)
}

module.exports = function attachPaymentRoutes(app) {
  if (USE_FAKE_DB) {
    const payments = new Map()

    app.post('/api/payments/create', (req, res) => {
      const orderId = req.body.order_id
      const gateway = req.body.gateway
      if (!orderId || !['wechat', 'alipay'].includes(gateway)) return res.status(400).json({ error: 'invalid_payload' })
      const id = crypto.randomUUID()
      const pay = { id, order_id: orderId, gateway, status: 'pending', amount_cents: 0, created_at: new Date().toISOString() }
      payments.set(id, pay)
      return res.status(201).json({ payment: pay, payment_url: `https://sandbox.example/pay/${gateway}/${id}` })
    })

    app.post('/api/payments/notify', (req, res) => {
      const paymentId = req.body.payment_id
      const success = !!req.body.success
      const pay = payments.get(paymentId)
      if (!pay) return res.status(404).json({ error: 'payment_not_found' })
      pay.status = success ? 'success' : 'failed'
      pay.gateway_payment_id = req.body.gateway_payment_id || null
      return res.json({ success: true, payment: pay })
    })

    return
  }

  app.post('/api/payments/create', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const orderId = req.body.order_id
    const gateway = req.body.gateway
    if (!orderId || !['wechat', 'alipay'].includes(gateway)) return res.status(400).json({ error: 'invalid_payload' })

    try {
      const orderRes = await q(
        isSqlite,
        `SELECT id, status, total_cents FROM orders WHERE id = ?`,
        `SELECT id, status, total_cents FROM orders WHERE id = $1`,
        [orderId]
      )
      const order = orderRes.rows && orderRes.rows[0]
      if (!order) return res.status(404).json({ error: 'order_not_found' })
      if (order.status !== 'created') return res.status(409).json({ error: 'order_not_payable', status: order.status })

      const paymentId = crypto.randomUUID()
      await q(
        isSqlite,
        `INSERT INTO payments (id, order_id, gateway, amount_cents, currency, status, raw_response, created_at)
         VALUES (?, ?, ?, ?, 'CNY', 'pending', ?, datetime('now'))`,
        `INSERT INTO payments (id, order_id, gateway, amount_cents, currency, status, raw_response)
         VALUES ($1, $2, $3, $4, 'CNY', 'pending', $5)`,
        [paymentId, orderId, gateway, order.total_cents, JSON.stringify({ sandbox: true })]
      )
      return res.status(201).json({
        payment_id: paymentId,
        order_id: orderId,
        gateway,
        amount_cents: Number(order.total_cents),
        payment_url: `https://sandbox.example/pay/${gateway}/${paymentId}`
      })
    } catch (err) {
      console.error('Error creating payment', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/payments/notify', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const paymentId = req.body.payment_id
    const gatewayPaymentId = req.body.gateway_payment_id || null
    const success = !!req.body.success
    if (!paymentId) return res.status(400).json({ error: 'invalid_payload' })

    const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'
    try {
      await query(beginSql)
      const paymentRes = await q(
        isSqlite,
        `SELECT * FROM payments WHERE id = ?`,
        `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
        [paymentId]
      )
      const payment = paymentRes.rows && paymentRes.rows[0]
      if (!payment) {
        await query('ROLLBACK')
        return res.status(404).json({ error: 'payment_not_found' })
      }

      if (payment.status === 'success') {
        await query('COMMIT')
        return res.json({ success: true, payment_id: paymentId, status: 'success', idempotent: true })
      }

      const newStatus = success ? 'success' : 'failed'
      await q(
        isSqlite,
        `UPDATE payments SET status = ?, gateway_payment_id = ?, raw_response = ? WHERE id = ?`,
        `UPDATE payments SET status = $1, gateway_payment_id = $2, raw_response = $3 WHERE id = $4`,
        [newStatus, gatewayPaymentId, JSON.stringify(req.body || {}), paymentId]
      )

      if (success) {
        await q(
          isSqlite,
          `UPDATE orders SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
          `UPDATE orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = $1`,
          [payment.order_id]
        )
        await q(
          isSqlite,
          `INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, 'paid', 'payment notify success', datetime('now'))`,
          `INSERT INTO order_status_history (id, order_id, status, note) VALUES ($1, $2, 'paid', 'payment notify success')`,
          [crypto.randomUUID(), payment.order_id]
        )
      }

      await query('COMMIT')
      return res.json({ success: true, payment_id: paymentId, status: newStatus, order_id: payment.order_id })
    } catch (err) {
      try { await query('ROLLBACK') } catch (_) {}
      console.error('Error handling payment notify', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}
