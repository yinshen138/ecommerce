const { query } = require('../db_adapter')

module.exports = function attachCartRoutes(app) {
  // Get cart
  app.get('/api/cart', async (req, res) => {
    try {
      const isSqlite = !process.env.DATABASE_URL
      const cart_id = req.query.cart_id
      const user_id = req.user && req.user.profile && req.user.profile.id
      let cartRes
      if (cart_id) {
        if (isSqlite) cartRes = await query('SELECT * FROM carts WHERE id = ?', [cart_id])
        else cartRes = await query('SELECT * FROM carts WHERE id = $1', [cart_id])
      } else if (user_id) {
        if (isSqlite) cartRes = await query('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [user_id])
        else cartRes = await query('SELECT * FROM carts WHERE user_id = $1 LIMIT 1', [user_id])
      } else {
        return res.json({ cart: null })
      }
      const cart = cartRes.rows && cartRes.rows[0]
      if (!cart) return res.json({ cart: null })
      let itemsRes
      if (isSqlite) itemsRes = await query('SELECT * FROM cart_items WHERE cart_id = ?', [cart.id])
      else itemsRes = await query('SELECT * FROM cart_items WHERE cart_id = $1', [cart.id])
      return res.json({ cart, items: itemsRes.rows })
    } catch (err) {
      console.error('Error fetching cart', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  // Add or update cart item
  app.post('/api/cart/items', async (req, res) => {
    try {
      const isSqlite = !process.env.DATABASE_URL
      const { cart_id, variant_id, qty } = req.body
      const user_id = req.user && req.user.profile && req.user.profile.id
      if (!variant_id || typeof qty !== 'number') return res.status(400).json({ error: 'invalid_payload' })

      let cart
      if (cart_id) {
        const cRes = isSqlite ? await query('SELECT * FROM carts WHERE id = ?', [cart_id]) : await query('SELECT * FROM carts WHERE id = $1', [cart_id])
        cart = cRes.rows && cRes.rows[0]
      }
      if (!cart && user_id) {
        const cRes = isSqlite ? await query('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [user_id]) : await query('SELECT * FROM carts WHERE user_id = $1 LIMIT 1', [user_id])
        cart = cRes.rows && cRes.rows[0]
      }
      if (!cart) {
        const newId = require('crypto').randomUUID()
        if (isSqlite) await query('INSERT INTO carts (id, user_id) VALUES (?, ?)', [newId, user_id || null])
        else await query('INSERT INTO carts (id, user_id) VALUES ($1, $2)', [newId, user_id || null])
        const cRes2 = isSqlite ? await query('SELECT * FROM carts WHERE id = ?', [newId]) : await query('SELECT * FROM carts WHERE id = $1', [newId])
        cart = cRes2.rows && cRes2.rows[0]
      }

      const existingRes = isSqlite ? await query('SELECT * FROM cart_items WHERE cart_id = ? AND variant_id = ?', [cart.id, variant_id]) : await query('SELECT * FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [cart.id, variant_id])
      if (existingRes.rows && existingRes.rows[0]) {
        const item = existingRes.rows[0]
        const newQty = item.qty + qty
        if (isSqlite) await query('UPDATE cart_items SET qty = ? WHERE id = ?', [newQty, item.id])
        else await query('UPDATE cart_items SET qty = $1 WHERE id = $2', [newQty, item.id])
        const updated = isSqlite ? await query('SELECT * FROM cart_items WHERE id = ?', [item.id]) : await query('SELECT * FROM cart_items WHERE id = $1', [item.id])
        return res.json({ item: updated.rows[0], cart_id: cart.id })
      } else {
        const itemId = require('crypto').randomUUID()
        if (isSqlite) await query('INSERT INTO cart_items (id, cart_id, variant_id, qty) VALUES (?, ?, ?, ?)', [itemId, cart.id, variant_id, qty])
        else await query('INSERT INTO cart_items (id, cart_id, variant_id, qty) VALUES ($1, $2, $3, $4)', [itemId, cart.id, variant_id, qty])
        const newItem = isSqlite ? await query('SELECT * FROM cart_items WHERE id = ?', [itemId]) : await query('SELECT * FROM cart_items WHERE id = $1', [itemId])
        return res.json({ item: newItem.rows[0], cart_id: cart.id })
      }
    } catch (err) {
      console.error('Error adding cart item', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  // update cart item qty
  app.patch('/api/cart/items/:id', async (req, res) => {
    try {
      const isSqlite = !process.env.DATABASE_URL
      const itemId = req.params.id
      const { qty } = req.body
      if (typeof qty !== 'number') return res.status(400).json({ error: 'invalid_payload' })
      if (isSqlite) await query('UPDATE cart_items SET qty = ? WHERE id = ?', [qty, itemId])
      else await query('UPDATE cart_items SET qty = $1 WHERE id = $2', [qty, itemId])
      const updated = isSqlite ? await query('SELECT * FROM cart_items WHERE id = ?', [itemId]) : await query('SELECT * FROM cart_items WHERE id = $1', [itemId])
      return res.json({ item: updated.rows[0] })
    } catch (err) {
      console.error('Error updating cart item', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  // delete cart item
  app.delete('/api/cart/items/:id', async (req, res) => {
    try {
      const isSqlite = !process.env.DATABASE_URL
      const itemId = req.params.id
      if (isSqlite) await query('DELETE FROM cart_items WHERE id = ?', [itemId])
      else await query('DELETE FROM cart_items WHERE id = $1', [itemId])
      return res.json({ success: true })
    } catch (err) {
      console.error('Error deleting cart item', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}
