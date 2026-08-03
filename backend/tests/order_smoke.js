const fetch = require('node-fetch')

const BASE = process.env.BASE_URL || 'http://localhost:4000'
const VARIANT_ID = process.env.SMOKE_VARIANT_ID || 'var-1'

async function jsonRes(res) {
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return txt }
}

async function run() {
  console.log('Starting order smoke against', BASE)

  let res = await fetch(BASE + '/api/checkout/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ variant_id: VARIANT_ID, qty: 2 }] })
  })
  if (!res.ok) throw new Error('preview failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const preview = await jsonRes(res)
  console.log('PREVIEW', preview)

  res = await fetch(BASE + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ variant_id: VARIANT_ID, qty: 2 }] })
  })
  if (!res.ok) throw new Error('create order failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const created = await jsonRes(res)
  console.log('CREATED', created)
  const orderId = created.order_id || (created.order && created.order.id)
  if (!orderId) throw new Error('missing order_id')

  res = await fetch(BASE + '/api/orders/' + orderId)
  if (!res.ok) throw new Error('fetch order failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const detail = await jsonRes(res)
  console.log('DETAIL', detail)
  if (!detail.items || detail.items.length === 0) throw new Error('order items missing')

  res = await fetch(BASE + '/api/orders/' + orderId + '/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'smoke_test_cancel' })
  })
  if (!res.ok) throw new Error('cancel failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const cancelled = await jsonRes(res)
  console.log('CANCELLED', cancelled)

  res = await fetch(BASE + '/api/orders/' + orderId)
  if (!res.ok) throw new Error('fetch cancelled order failed: ' + res.status + ' ' + JSON.stringify(await jsonRes(res)))
  const detailAfterCancel = await jsonRes(res)
  if (!detailAfterCancel.order || detailAfterCancel.order.status !== 'cancelled') throw new Error('order status not cancelled')
  console.log('DETAIL_AFTER_CANCEL', detailAfterCancel)

  console.log('Order smoke passed')
}

run().catch((err) => {
  console.error('Order smoke failed:', err)
  process.exit(1)
})
