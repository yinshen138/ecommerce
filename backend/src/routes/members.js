const { query } = require('../db_adapter')
const USE_FAKE_DB = process.env.USE_FAKE_DB === '1'

module.exports = function attachMemberRoutes(app) {
  if (USE_FAKE_DB) {
    const members = new Map() // user_id -> { user_id, level, points, created_at, updated_at }
    function nowStr(){ return new Date().toISOString().replace('T',' ').split('.')[0] }

    app.get('/api/members', (req, res) => {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const m = members.get(userId) || { user_id: userId, level: 'free', points: 0 }
      return res.json({ member: m })
    })

    app.post('/api/members/upgrade', (req, res) => {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const { level } = req.body
      if (!level) return res.status(400).json({ error: 'invalid_payload' })
      const now = nowStr()
      const existing = members.get(userId) || { user_id: userId, level: 'free', points: 0, created_at: now, updated_at: now }
      existing.level = level
      existing.updated_at = now
      members.set(userId, existing)
      return res.json({ member: existing })
    })

    return
  }

  // SQL mode: simple operations assuming memberships table exists
  app.get('/api/members', async (req, res) => {
    try {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const isSqlite = !process.env.DATABASE_URL
      const r = isSqlite ? await query('SELECT * FROM memberships WHERE user_id = ? LIMIT 1', [userId]) : await query('SELECT * FROM memberships WHERE user_id = $1 LIMIT 1', [userId])
      if (r.rows && r.rows[0]) return res.json({ member: r.rows[0] })
      return res.json({ member: { user_id: userId, level: 'free', points: 0 } })
    } catch (err) {
      console.error('Error fetching membership', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  app.post('/api/members/upgrade', async (req, res) => {
    try {
      const userId = req.user && req.user.profile && req.user.profile.id
      if (!userId) return res.status(401).json({ error: 'unauthenticated' })
      const { level } = req.body
      if (!level) return res.status(400).json({ error: 'invalid_payload' })
      const isSqlite = !process.env.DATABASE_URL
      const now = new Date().toISOString()
      const existing = isSqlite ? await query('SELECT * FROM memberships WHERE user_id = ? LIMIT 1', [userId]) : await query('SELECT * FROM memberships WHERE user_id = $1 LIMIT 1', [userId])
      if (existing.rows && existing.rows[0]) {
        if (isSqlite) await query('UPDATE memberships SET level = ?, updated_at = datetime(\'now\') WHERE user_id = ?', [level, userId])
        else await query('UPDATE memberships SET level = $1, updated_at = now() WHERE user_id = $2', [level, userId])
      } else {
        const id = require('crypto').randomUUID()
        if (isSqlite) await query('INSERT INTO memberships (id, user_id, level, points, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))', [id, userId, level, 0])
        else await query('INSERT INTO memberships (id, user_id, level, points, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now())', [id, userId, level, 0])
      }
      const r = isSqlite ? await query('SELECT * FROM memberships WHERE user_id = ?', [userId]) : await query('SELECT * FROM memberships WHERE user_id = $1', [userId])
      return res.json({ member: r.rows[0] })
    } catch (err) {
      console.error('Error upgrading membership', err)
      return res.status(500).json({ error: 'internal_error' })
    }
  })
}
