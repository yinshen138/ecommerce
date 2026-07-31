// Simple adapter: use SQLite if SQLITE_PATH set, otherwise use Postgres db.js
let adapter
if (process.env.SQLITE_PATH || process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL) {
  adapter = require('./db_sqlite')
} else {
  adapter = require('./db')
}

module.exports = adapter
