const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

let dbInstance = null;

function initDatabase(customPath = null) {
  const dbFile = customPath || config.dbPath;
  const dir = path.dirname(dbFile);
  if (dbFile !== ':memory:' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
      console.error('Failed to connect to SQLite database:', err.message);
    }
  });

  // Enable foreign keys and WAL mode for optimal performance and integrity
  db.run('PRAGMA foreign_keys = ON;');
  if (dbFile !== ':memory:') {
    db.run('PRAGMA journal_mode = WAL;');
  }

  const dbWrapper = {
    raw: db,
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };

  dbInstance = dbWrapper;
  return dbWrapper;
}

function getDatabase() {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

module.exports = {
  initDatabase,
  getDatabase
};
