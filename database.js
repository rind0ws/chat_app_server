const sqlite3 = require('sqlite3').verbose();
// データベースファイルを開く。
const db = new sqlite3.Database('./chat_app.db');

module.exports = db;