const { query } = require('../db_adapter')

// Provide an opt-in in-memory DB for smoke tests.
const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'

module.exports = function attachCartRoutes(app) {
  if (USE_FAKE_DB) {
    const carts = new Map() // cart_id -> { id, user_id, created_at, updated_at }
    const items = new Map() // item_id -> { id, cart_id, variant_id, qty, added_at }

    function nowStr() { return new Date().toISOString().replace('T',' ').split('.')[0] }

    app.get('/api/cart', (req, res) => {
      const cart_id = req.query.cart_id
      if (!cart_id) return res.json({ cart: null })
      const cart = carts.get(cart_id) || null
      const cartItems = Array.from(items.values()).filter(i => i.cart_id === cart_id)
      return res.json({ cart, items: cartItems })
    })

    app.post('/api/cart/items', (req, res) => {
      const { cart_id, variant_id, qty } = req.body
      if (!variant_id || typeof qty !== 'number') return res.status(400).json({ error: 'invalid_payload' })
      let cart = cart_id ? carts.get(cart_id) : null
      if (!cart) {
        const newCartId = require('crypto').randomUUID()
        cart = { id: newCartId, user_id: null, created_at: nowStr(), updated_at: nowStr() }
        carts.set(newCartId, cart)
      }
      // find existing item by cart and variant
      const existing = Array.from(items.values()).find(i => i.cart_id === cart.id && i.variant_id === variant_id)
      if (existing) {
        existing.qty = existing.qty + qty
        return res.json({ item: existing, cart_id: cart.id })
      }
      const itemId = require('crypto').randomUUID()
      const newItem = { id: itemId, cart_id: cart.id, variant_id, qty, added_at: nowStr() }
      items.set(itemId, newItem)
      return res.json({ item: newItem, cart_id: cart.id })
    })

    app.patch('/api/cart/items/:id', (req, res) => {
      const itemId = req.params.id
      const { qty } = req.body
      if (typeof qty !== 'number') return res.status(400).json({ error: 'invalid_payload' })
      const it = items.get(itemId)
      if (!it) return res.status(404).json({ error: 'not_found' })
      it.qty = qty
      return res.json({ item: it })
    })

    app.delete('/api/cart/items/:id', (req, res) => {
      const itemId = req.params.id
      items.delete(itemId)
      return res.json({ success: true })
    })

    return
  }

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

  // bulk update cart items (array of {id, qty})
  app.patch('/api/cart/items', async (req, res) => {
    try {
      const updates = Array.isArray(req.body.updates) ? req.body.updates : []
      if (updates.length === 0) return res.status(400).json({ error: 'invalid_payload' })
      const isSqlite = !process.env.DATABASE_URL
      const results = []
      for (const u of updates) {
        if (!u.id || typeof u.qty !== 'number') continue
        if (isSqlite) await query('UPDATE cart_items SET qty = ? WHERE id = ?', [u.qty, u.id])
        else await query('UPDATE cart_items SET qty = $1 WHERE id = $2', [u.qty, u.id])
        const r = isSqlite ? await query('SELECT * FROM cart_items WHERE id = ?', [u.id]) : await query('SELECT * FROM cart_items WHERE id = $1', [u.id])
        if (r.rows && r.rows[0]) results.push(r.rows[0])
      }
      return res.json({ items: results })
    } catch (err) {
      console.error('Error bulk updating cart items', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  // delete cart items in bulk (body: { ids: [id...] })
  app.delete('/api/cart/items', async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids : []
      if (ids.length === 0) return res.status(400).json({ error: 'invalid_payload' })
      const isSqlite = !process.env.DATABASE_URL
      for (const id of ids) {
        if (isSqlite) await query('DELETE FROM cart_items WHERE id = ?', [id])
        else await query('DELETE FROM cart_items WHERE id = $1', [id])
      }
      return res.json({ success: true })
    } catch (err) {
      console.error('Error bulk deleting cart items', err)
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
