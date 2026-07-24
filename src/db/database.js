const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(__dirname, 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
