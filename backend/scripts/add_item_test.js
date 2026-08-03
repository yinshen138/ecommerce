const { query } = require('../src/db_adapter')
;(async ()=>{
  try{
    const isSqlite = !process.env.DATABASE_URL
    const variant_id='var-1'
    const qty=1
    // ensure cart (create new)
    const newId = require('crypto').randomUUID()
    if (isSqlite) await query('INSERT INTO carts (id, user_id) VALUES (?, ?)', [newId, null])
    else await query('INSERT INTO carts (id, user_id) VALUES ($1, $2)', [newId, null])
    console.log('Created cart', newId)
    const itemId = require('crypto').randomUUID()
    if (isSqlite) await query('INSERT INTO cart_items (id, cart_id, variant_id, qty) VALUES (?, ?, ?, ?)', [itemId, newId, variant_id, qty])
    else await query('INSERT INTO cart_items (id, cart_id, variant_id, qty) VALUES ($1, $2, $3, $4)', [itemId, newId, variant_id, qty])
    console.log('Inserted item', itemId)
    const res = await query('SELECT * FROM cart_items WHERE id = ?', [itemId])
    console.log(res.rows)
  }catch(e){ console.error('err', e) }
})()
