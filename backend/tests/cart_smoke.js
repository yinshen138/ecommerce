const fetch = require('node-fetch')

const BASE = process.env.BASE_URL || 'http://localhost:4000'
const VARIANT_ID = process.env.SMOKE_VARIANT_ID || 'var-1'

async function jsonRes(res){
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { return txt }
}

async function run(){
  console.log('Starting cart smoke against', BASE)
  // create
  let res = await fetch(BASE + '/api/cart/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variant_id: VARIANT_ID, qty: 1 })
  })
  if (!res.ok) throw new Error('POST failed: '+res.status)
  const created = await jsonRes(res)
  console.log('CREATED', created)
  const itemId = created.item.id
  const cartId = created.cart_id

  // list
  res = await fetch(BASE + `/api/cart?cart_id=${cartId}`)
  if (!res.ok) throw new Error('GET cart failed: '+res.status)
  console.log('LIST', await jsonRes(res))

  // patch
  res = await fetch(BASE + `/api/cart/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qty: 4 })
  })
  if (!res.ok) throw new Error('PATCH failed: '+res.status)
  console.log('PATCHED', await jsonRes(res))

  // verify
  res = await fetch(BASE + `/api/cart?cart_id=${cartId}`)
  if (!res.ok) throw new Error('GET after patch failed: '+res.status)
  console.log('LIST_AFTER_PATCH', await jsonRes(res))

  // delete
  res = await fetch(BASE + `/api/cart/items/${itemId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('DELETE failed: '+res.status)
  console.log('DELETED', await jsonRes(res))

  // final verify
  res = await fetch(BASE + `/api/cart?cart_id=${cartId}`)
  if (!res.ok) throw new Error('Final GET failed: '+res.status)
  console.log('FINAL_LIST', await jsonRes(res))

  console.log('Cart smoke passed')
}

run().catch(err => { console.error('Smoke failed:', err); process.exit(1) })
