const crypto = require('crypto')
const { query } = require('../db_adapter')
const {
  createAlipayOrder,
  createWechatOrder,
  decryptWechatResource,
  verifyAlipayNotify
} = require('../payment_gateways')

const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'
const PAYMENT_PROVIDER_MODE = process.env.PAYMENT_PROVIDER_MODE || 'sandbox' // sandbox | real

function q(isSqlite, sqliteSql, pgSql, params) {
  return query(isSqlite ? sqliteSql : pgSql, params)
}

async function markPaymentFinal(isSqlite, paymentId, gatewayPaymentId, success, rawPayload) {
  const beginSql = isSqlite ? 'BEGIN IMMEDIATE' : 'BEGIN'
  await query(beginSql)
  try {
    const paymentRes = await q(
      isSqlite,
      `SELECT * FROM payments WHERE id = ?`,
      `SELECT * FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    )
    const payment = paymentRes.rows && paymentRes.rows[0]
    if (!payment) {
      await query('ROLLBACK')
      return { error: 'payment_not_found', status: 404 }
    }
    if (payment.status === 'success') {
      await query('COMMIT')
      return { ok: true, status: 'success', payment, idempotent: true }
    }

    const newStatus = success ? 'success' : 'failed'
    await q(
      isSqlite,
      `UPDATE payments SET status = ?, gateway_payment_id = ?, raw_response = ? WHERE id = ?`,
      `UPDATE payments SET status = $1, gateway_payment_id = $2, raw_response = $3 WHERE id = $4`,
      [newStatus, gatewayPaymentId || null, JSON.stringify(rawPayload || {}), paymentId]
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
    return { ok: true, status: newStatus, order_id: payment.order_id }
  } catch (err) {
    try { await query('ROLLBACK') } catch (_) {}
    throw err
  }
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

    app.post('/api/payments/notify/alipay', (req, res) => {
      const outTradeNo = req.body.out_trade_no || req.body.payment_id
      const pay = payments.get(outTradeNo)
      if (!pay) return res.status(404).send('fail')
      pay.status = 'success'
      pay.gateway_payment_id = req.body.trade_no || null
      return res.send('success')
    })

    app.post('/api/payments/notify/wechat', (req, res) => {
      const outTradeNo = req.body.out_trade_no || (req.body.resource && req.body.resource.out_trade_no)
      const pay = payments.get(outTradeNo)
      if (!pay) return res.status(404).json({ code: 'FAIL', message: 'payment_not_found' })
      pay.status = 'success'
      pay.gateway_payment_id = req.body.transaction_id || null
      return res.json({ code: 'SUCCESS', message: 'OK' })
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
        [paymentId, orderId, gateway, order.total_cents, JSON.stringify({ mode: PAYMENT_PROVIDER_MODE })]
      )

      let providerResult
      if (PAYMENT_PROVIDER_MODE === 'real') {
        if (gateway === 'alipay') {
          providerResult = await createAlipayOrder({
            paymentId,
            subject: `Order ${orderId}`,
            amountCents: Number(order.total_cents)
          })
        } else {
          providerResult = await createWechatOrder({
            paymentId,
            subject: `Order ${orderId}`,
            amountCents: Number(order.total_cents)
          })
        }
      } else {
        providerResult = {
          gateway,
          payment_url: `https://sandbox.example/pay/${gateway}/${paymentId}`,
          gateway_payment_id: paymentId,
          raw: { sandbox: true }
        }
      }

      await q(
        isSqlite,
        `UPDATE payments SET gateway_payment_id = ?, raw_response = ? WHERE id = ?`,
        `UPDATE payments SET gateway_payment_id = $1, raw_response = $2 WHERE id = $3`,
        [providerResult.gateway_payment_id || null, JSON.stringify(providerResult.raw || {}), paymentId]
      )

      return res.status(201).json({
        payment_id: paymentId,
        order_id: orderId,
        gateway,
        mode: PAYMENT_PROVIDER_MODE,
        amount_cents: Number(order.total_cents),
        payment_url: providerResult.payment_url,
        gateway_payment_id: providerResult.gateway_payment_id || null
      })
    } catch (err) {
      console.error('Error creating payment', err)
      return res.status(500).json({ error: 'internal_error', message: err.message })
    }
  })

  // Generic notify for local/manual testing.
  app.post('/api/payments/notify', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    const paymentId = req.body.payment_id
    const gatewayPaymentId = req.body.gateway_payment_id || null
    const success = !!req.body.success
    if (!paymentId) return res.status(400).json({ error: 'invalid_payload' })

    try {
      const result = await markPaymentFinal(isSqlite, paymentId, gatewayPaymentId, success, req.body)
      if (result.error) return res.status(result.status || 400).json({ error: result.error })
      return res.json({ success: true, payment_id: paymentId, status: result.status, order_id: result.order_id, idempotent: !!result.idempotent })
    } catch (err) {
      console.error('Error handling payment notify', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/payments/notify/alipay', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    try {
      const verified = verifyAlipayNotify(req.body)
      if (!verified) return res.status(400).send('fail')

      const outTradeNo = req.body.out_trade_no
      const tradeNo = req.body.trade_no || null
      const tradeStatus = req.body.trade_status
      if (!outTradeNo) return res.status(400).send('fail')
      const success = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED'
      const result = await markPaymentFinal(isSqlite, outTradeNo, tradeNo, success, req.body)
      if (result.error) return res.status(404).send('fail')
      return res.send('success')
    } catch (err) {
      console.error('Error handling alipay notify', err)
      return res.status(500).send('fail')
    }
  })

  app.post('/api/payments/notify/wechat', async (req, res) => {
    const isSqlite = !process.env.DATABASE_URL
    try {
      let payload = req.body
      if (req.body && req.body.resource && req.body.resource.ciphertext) {
        const apiV3Key = process.env.WECHAT_API_V3_KEY
        if (!apiV3Key) return res.status(500).json({ code: 'FAIL', message: 'missing_wechat_api_v3_key' })
        payload = decryptWechatResource(req.body.resource, apiV3Key)
      }

      const outTradeNo = payload.out_trade_no
      const transactionId = payload.transaction_id || null
      const tradeState = payload.trade_state || (req.body && req.body.event_type === 'TRANSACTION.SUCCESS' ? 'SUCCESS' : null)
      if (!outTradeNo) return res.status(400).json({ code: 'FAIL', message: 'missing_out_trade_no' })
      const success = tradeState === 'SUCCESS'
      const result = await markPaymentFinal(isSqlite, outTradeNo, transactionId, success, req.body)
      if (result.error) return res.status(404).json({ code: 'FAIL', message: result.error })
      return res.json({ code: 'SUCCESS', message: 'OK' })
    } catch (err) {
      console.error('Error handling wechat notify', err)
      return res.status(500).json({ code: 'FAIL', message: 'internal_error' })
    }
  })
}
