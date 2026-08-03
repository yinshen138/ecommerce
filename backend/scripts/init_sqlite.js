const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', '..', 'dev.sqlite3')
const schemaPath = process.env.SQLITE_SCHEMA_PATH || path.join(__dirname, '..', '..', 'db', 'sqlite_schema.sql')
const seedPath = process.env.SQLITE_SEED_PATH || path.join(__dirname, '..', '..', 'db', 'sqlite_seed.sql')

console.log('Opening DB:', dbPath)
const db = new Database(dbPath)
if (fs.existsSync(schemaPath)) {
  const sql = fs.readFileSync(schemaPath, 'utf8')
  db.exec(sql)
  console.log('Applied schema from', schemaPath)
}
if (fs.existsSync(seedPath)) {
  const s = fs.readFileSync(seedPath, 'utf8')
  db.exec(s)
  console.log('Applied seed from', seedPath)
}
console.log('Done')
