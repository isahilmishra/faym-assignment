const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(__dirname, 'data.sqlite');
const db = new DatabaseSync(dbPath);

// Polyfill db.pragma
db.pragma = function (str) {
  db.exec(`PRAGMA ${str}`);
};

// Polyfill db.transaction
db.transaction = function (fn) {
  return function (...args) {
    db.exec('BEGIN TRANSACTION');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
