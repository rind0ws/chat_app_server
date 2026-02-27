// server/database.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat_app.db');

db.serialize(() => {
  // ユーザーテーブルの作成
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    user_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    is_locked INTEGER DEFAULT 0,
    lock_until DATETIME )`
  );

  // メッセージテーブルの作成
  db.run(
    `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    message_text TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(user_id) )`
  );
});

module.exports = db;