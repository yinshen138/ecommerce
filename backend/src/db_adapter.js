// Simple adapter: support an in-memory fake adapter when explicitly requested.
let adapter
if (process.env.USE_FAKE_DB === '1') {
  adapter = require('./db_memory')
} else if (process.env.SQLITE_PATH || (process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL)) {
  adapter = require('./db_sqlite')
} else {
  adapter = require('./db')
}

module.exports = adapter
