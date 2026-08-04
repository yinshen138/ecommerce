const { query } = require('../db_adapter')
const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'

module.exports = function attachAddressRoutes(app) {
  if (USE_FAKE_DB) {
    const addresses = new Map()
    function nowStr() { return new Date().toISOString().replace('T',' ').split('.')[0] }

    app.get('/api/addresses', (req, res) => {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const list = Array.from(addresses.values()).filter(a => a.user_id === userId)
      return res.json({ addresses: list })
    })

    app.post('/api/addresses', (req, res) => {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const { full_name, phone, line1, city, state, postal_code, country, is_default } = req.body
      if (!line1 || !city) return res.status(400).json({ error: 'invalid_payload' })
      const id = require('crypto').randomUUID()
      const addr = { id, user_id: userId, full_name: full_name || null, phone: phone || null, line1, city, state: state || null, postal_code: postal_code || null, country: country || 'CN', is_default: !!is_default, created_at: nowStr(), updated_at: nowStr() }
      if (addr.is_default) {
        for (const a of addresses.values()) if (a.user_id === userId) a.is_default = false
      }
      addresses.set(id, addr)
      return res.status(201).json({ address: addr })
    })

    app.patch('/api/addresses/:id', (req, res) => {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const id = req.params.id
      const a = addresses.get(id)
      if (!a || a.user_id !== userId) return res.status(404).json({ error: 'not_found' })
      const { full_name, phone, line1, city, state, postal_code, country, is_default } = req.body
      if (typeof full_name !== 'undefined') a.full_name = full_name
      if (typeof phone !== 'undefined') a.phone = phone
      if (typeof line1 !== 'undefined') a.line1 = line1
      if (typeof city !== 'undefined') a.city = city
      if (typeof state !== 'undefined') a.state = state
      if (typeof postal_code !== 'undefined') a.postal_code = postal_code
      if (typeof country !== 'undefined') a.country = country
      if (typeof is_default !== 'undefined' && is_default) {
        for (const other of addresses.values()) if (other.user_id === userId) other.is_default = false
        a.is_default = true
      }
      a.updated_at = nowStr()
      return res.json({ address: a })
    })

    app.delete('/api/addresses/:id', (req, res) => {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const id = req.params.id
      const a = addresses.get(id)
      if (!a || a.user_id !== userId) return res.status(404).json({ error: 'not_found' })
      addresses.delete(id)
      return res.json({ success: true })
    })

    return
  }

  // SQL-backed routes
  app.get('/api/addresses', async (req, res) => {
    try {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const isSqlite = !process.env.DATABASE_URL
      const rows = isSqlite ? await query('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [userId]) : await query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [userId])
      return res.json({ addresses: rows.rows || [] })
    } catch (err) {
      console.error('Error fetching addresses', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/addresses', async (req, res) => {
    try {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const { full_name, phone, line1, city, state, postal_code, country, is_default } = req.body
      if (!line1 || !city) return res.status(400).json({ error: 'invalid_payload' })
      const id = require('crypto').randomUUID()
      const isSqlite = !process.env.DATABASE_URL
      if (is_default) {
        if (isSqlite) await query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId])
        else await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId])
      }
      if (isSqlite) await query('INSERT INTO addresses (id, user_id, full_name, phone, line1, city, state, postal_code, country, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', [id, userId, full_name || null, phone || null, line1, city, state || null, postal_code || null, country || 'CN', is_default ? 1 : 0])
      else await query('INSERT INTO addresses (id, user_id, full_name, phone, line1, city, state, postal_code, country, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [id, userId, full_name || null, phone || null, line1, city, state || null, postal_code || null, country || 'CN', is_default ? true : false])
      const resRow = isSqlite ? await query('SELECT * FROM addresses WHERE id = ?', [id]) : await query('SELECT * FROM addresses WHERE id = $1', [id])
      return res.status(201).json({ address: resRow.rows[0] })
    } catch (err) {
      console.error('Error creating address', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.patch('/api/addresses/:id', async (req, res) => {
    try {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const id = req.params.id
      const { full_name, phone, line1, city, state, postal_code, country, is_default } = req.body
      const isSqlite = !process.env.DATABASE_URL
      if (is_default) {
        if (isSqlite) await query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId])
        else await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId])
      }
      const updates = []
      const params = []
      if (typeof full_name !== 'undefined') { updates.push(isSqlite ? 'full_name = ?' : 'full_name = $' + (params.length+1)); params.push(full_name) }
      if (typeof phone !== 'undefined') { updates.push(isSqlite ? 'phone = ?' : 'phone = $' + (params.length+1)); params.push(phone) }
      if (typeof line1 !== 'undefined') { updates.push(isSqlite ? 'line1 = ?' : 'line1 = $' + (params.length+1)); params.push(line1) }
      if (typeof city !== 'undefined') { updates.push(isSqlite ? 'city = ?' : 'city = $' + (params.length+1)); params.push(city) }
      if (typeof state !== 'undefined') { updates.push(isSqlite ? 'state = ?' : 'state = $' + (params.length+1)); params.push(state) }
      if (typeof postal_code !== 'undefined') { updates.push(isSqlite ? 'postal_code = ?' : 'postal_code = $' + (params.length+1)); params.push(postal_code) }
      if (typeof country !== 'undefined') { updates.push(isSqlite ? 'country = ?' : 'country = $' + (params.length+1)); params.push(country) }
      if (typeof is_default !== 'undefined') { updates.push(isSqlite ? 'is_default = ?' : 'is_default = $' + (params.length+1)); params.push(is_default ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false)) }
      if (updates.length === 0) return res.status(400).json({ error: 'invalid_payload' })
      if (isSqlite) {
        params.push(id)
        await query('UPDATE addresses SET ' + updates.join(', ') + ', updated_at = datetime(\'now\') WHERE id = ?', params)
        const r = await query('SELECT * FROM addresses WHERE id = ?', [id])
        return res.json({ address: r.rows[0] })
      } else {
        params.push(id)
        // adjust $n indexes correctly
        const setClause = updates.map((u, idx) => u.replace(/\$(\d+)/, (m, p1) => '$' + (Number(p1) )))
        await query('UPDATE addresses SET ' + updates.join(', ') + ', updated_at = now() WHERE id = $' + (params.length), params)
        const r = await query('SELECT * FROM addresses WHERE id = $1', [id])
        return res.json({ address: r.rows[0] })
      }
    } catch (err) {
      console.error('Error updating address', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.delete('/api/addresses/:id', async (req, res) => {
    try {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const id = req.params.id
      const isSqlite = !process.env.DATABASE_URL
      if (isSqlite) await query('DELETE FROM addresses WHERE id = ?', [id])
      else await query('DELETE FROM addresses WHERE id = $1', [id])
      return res.json({ success: true })
    } catch (err) {
      console.error('Error deleting address', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}
