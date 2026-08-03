const fetch = require('node-fetch')
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

async function getUserFromToken(token) {
  if (!token) return null
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apiKey: SUPABASE_KEY || ''
    }
  })
  if (!res.ok) return null
  const body = await res.json()
  return body
}

function authMiddleware() {
  return async function (req, res, next) {
    try {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      if (!token) {
        req.user = null
        return next()
      }
      const user = await getUserFromToken(token)
      // keep backward compatibility but also attach claims if present
      req.user = user
      return next()
    } catch (err) {
      console.error('Auth middleware error', err)
      req.user = null
      return next()
    }
  }
}

module.exports = { getUserFromToken, authMiddleware }
