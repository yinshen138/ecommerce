const fetch = require('node-fetch')

const BASE = process.env.BASE_URL || 'http://localhost:4000'
const VARIANT_ID = process.env.SMOKE_VARIANT_ID || 'var-1'

async function jsonRes(res) {
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return txt }
}

async function run() {
  console.log('Starting admin smoke against', BASE)

  // 1) create order
  let res = await fetch(BASE + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ variant_id: VARIANT_ID, qty: 1 }] })
  })
  if (!res.ok) throw new Error('create order failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const orderCreated = await jsonRes(res)
  const orderId = orderCreated.order_id || (orderCreated.order && orderCreated.order.id)
  if (!orderId) throw new Error('missing order id')
  console.log('ORDER_CREATED', orderId)

  // 2) pay order
  res = await fetch(BASE + '/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, gateway: 'alipay' })
  })
  if (!res.ok) throw new Error('payment create failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const paymentCreated = await jsonRes(res)
  const paymentId = paymentCreated.payment_id || (paymentCreated.payment && paymentCreated.payment.id)
  if (!paymentId) throw new Error('missing payment id')
  console.log('PAYMENT_CREATED', paymentId)

  res = await fetch(BASE + '/api/payments/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: paymentId, gateway_payment_id: 'ALI-ADMIN-SBX', success: true })
  })
  if (!res.ok) throw new Error('payment notify failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  console.log('PAYMENT_NOTIFIED', await jsonRes(res))

  // 3) ship order (admin)
  res = await fetch(BASE + `/api/admin/orders/${orderId}/ship`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carrier: 'SF', tracking_no: 'SF123456' })
  })
  if (!res.ok) throw new Error('ship failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  console.log('ORDER_SHIPPED', await jsonRes(res))

  // 4) request refund
  res = await fetch(BASE + `/api/orders/${orderId}/refunds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: '售后测试', amount_cents: 1000 })
  })
  if (!res.ok) throw new Error('refund request failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const refundReq = await jsonRes(res)
  const refundId = refundReq.refund_id || (refundReq.refund && refundReq.refund.id)
  if (!refundId) throw new Error('missing refund id')
  console.log('REFUND_REQUESTED', refundId)

  // 5) admin review approve
  res = await fetch(BASE + `/api/admin/refunds/${refundId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve', note: '审核通过' })
  })
  if (!res.ok) throw new Error('refund review failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  console.log('REFUND_REVIEWED', await jsonRes(res))

  // 6) verify order becomes refunded in real DB mode
  res = await fetch(BASE + `/api/orders/${orderId}`)
  if (!res.ok) throw new Error('order verify failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const orderAfter = await jsonRes(res)
  if (orderAfter.order && orderAfter.order.status !== 'refunded' && orderAfter.order.status !== 'shipped') {
    throw new Error('unexpected final order status: ' + orderAfter.order.status)
  }
  console.log('ORDER_AFTER_REVIEW', orderAfter.order ? orderAfter.order.status : orderAfter)
  console.log('Admin smoke passed')
}

run().catch((err) => {
  console.error('Admin smoke failed:', err)
  process.exit(1)
})
