const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', '..', 'dev.sqlite3')
const initSchemaPath = process.env.SQLITE_SCHEMA_PATH || path.join(__dirname, '..', '..', 'db', 'sqlite_schema.sql')
const seedPath = process.env.SQLITE_SEED_PATH || path.join(__dirname, '..', '..', 'db', 'sqlite_seed.sql')

let db
if (!fs.existsSync(dbPath)) {
  db = new Database(dbPath)
  if (fs.existsSync(initSchemaPath)) {
    const sql = fs.readFileSync(initSchemaPath, 'utf8')
    db.exec(sql)
  }
  if (fs.existsSync(seedPath)) {
    const s = fs.readFileSync(seedPath, 'utf8')
    db.exec(s)
  }
} else {
  db = new Database(dbPath)
}

function query(sql, params) {
  // Simple mapping: if sql starts with SELECT return rows, else run and return changes
  const stmt = db.prepare(sql)
  if (/^\s*select/i.test(sql)) {
    const rows = stmt.all(params || [])
    return Promise.resolve({ rows })
  } else {
    const info = stmt.run(params || [])
    return Promise.resolve({ info })
  }
}

module.exports = { query, db }
