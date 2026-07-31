// script to force sqlite usage when running node via npm script
// usage: node scripts/force_sqlite.js src/index.js
const path = require('path')
const fs = require('fs')

// ensure SQLITE_PATH is set to repo dev.sqlite3 if not provided
const repoRoot = path.join(__dirname, '..')
const defaultSqlite = path.join(repoRoot, '..', 'dev.sqlite3')
if (!process.env.SQLITE_PATH) process.env.SQLITE_PATH = defaultSqlite
// unset DATABASE_URL to force sqlite adapter to be selected
process.env.DATABASE_URL = ''

// execute the target script
const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/force_sqlite.js <script-to-run>')
  process.exit(1)
}

require(path.resolve(target))
