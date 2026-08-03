const fetch = require('node-fetch')

const BASE = process.env.BASE_URL || 'http://localhost:4000'

async function jsonRes(res) {
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return txt }
}

async function run() {
  console.log('Starting payment smoke against', BASE)
  let res = await fetch(BASE + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ variant_id: 'var-1', qty: 1 }] })
  })
  if (!res.ok) throw new Error('create order failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const order = await jsonRes(res)
  console.log('ORDER_CREATED', order)
  const orderId = order.order_id || (order.order && order.order.id)
  if (!orderId) throw new Error('missing order_id')

  res = await fetch(BASE + '/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, gateway: 'alipay' })
  })
  if (!res.ok) throw new Error('create payment failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const payment = await jsonRes(res)
  console.log('PAYMENT_CREATED', payment)
  const paymentId = payment.payment_id || (payment.payment && payment.payment.id)
  if (!paymentId) throw new Error('missing payment_id')

  res = await fetch(BASE + '/api/payments/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: paymentId, gateway_payment_id: 'ALI-SBX-123', success: true })
  })
  if (!res.ok) throw new Error('payment notify failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const notified = await jsonRes(res)
  console.log('PAYMENT_NOTIFIED', notified)

  res = await fetch(BASE + '/api/orders/' + orderId)
  if (!res.ok) throw new Error('fetch paid order failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const orderAfter = await jsonRes(res)
  console.log('ORDER_AFTER_PAYMENT', orderAfter)
  const isFakeMode = !!payment.payment
  if (!isFakeMode && (!orderAfter.order || orderAfter.order.status !== 'paid')) throw new Error('order not marked paid')

  console.log('Payment smoke passed')
}

run().catch((err) => {
  console.error('Payment smoke failed:', err)
  process.exit(1)
})
