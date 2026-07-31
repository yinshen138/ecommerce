const { createRemoteJWKSet, jwtVerify } = require('jose')
const LRU = require('lru-cache')
const { query } = require('./db')

const jwksCache = new LRU({ max: 50, ttl: 1000 * 60 * 60 }) // 1 hour

function getJwksUrl() {
  const supabaseUrl = process.env.SUPABASE_URL
  const jwks = process.env.SUPABASE_JWKS_URL
  if (jwks) return jwks
  if (!supabaseUrl) throw new Error('SUPABASE_URL or SUPABASE_JWKS_URL must be set')
  // Supabase exposes certs at /auth/v1/certs
  return supabaseUrl.replace(/\/$/, '') + '/auth/v1/certs'
}

function getJwksClient() {
  const url = getJwksUrl()
  if (jwksCache.get('client')) return jwksCache.get('client')
  const client = createRemoteJWKSet(new URL(url))
  jwksCache.set('client', client)
  return client
}

async function verifyToken(token) {
  if (!token) throw new Error('No token')
  const client = getJwksClient()
  // decode and verify
  const { payload } = await jwtVerify(token, client, {
    issuer: process.env.SUPABASE_JWT_ISSUER, // optional
    audience: process.env.SUPABASE_JWT_AUD || undefined
  })
  return payload
}

function jwtMiddleware() {
  return async function (req, res, next) {
    try {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      if (!token) { req.user = null; return next() }
      const payload = await verifyToken(token)
      // attach claims
      req.user = { claims: payload }
      // optional: sync with local users table by sub (auth user id)
      const sub = payload.sub
      if (sub) {
        try {
          const r = await query('SELECT id, email, role, display_name FROM users WHERE id = $1 OR email = $2 LIMIT 1', [sub, payload.email])
          if (r.rows && r.rows[0]) {
            req.user.profile = r.rows[0]
            req.user.isAdmin = (r.rows[0].role === 'admin')
          } else {
            req.user.isAdmin = false
          }
        } catch (err) {
          console.error('Error querying user for role', err)
          req.user.isAdmin = false
        }
      }
      return next()
    } catch (err) {
      console.warn('JWT verification failed:', err.message)
      req.user = null
      return next()
    }
  }
}

function requireAdmin() {
  return function (req, res, next) {
    if (req.user && req.user.isAdmin) return next()
    return res.status(403).json({ error: 'admin_required' })
  }
}

module.exports = { verifyToken, jwtMiddleware, requireAdmin }
