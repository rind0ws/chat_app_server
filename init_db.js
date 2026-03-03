const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./chat_app.db');

async function init() {
  const saltRounds = 10;
  
  // テスト用パスワードのハッシュ化
  const adminHash = await bcrypt.hash('admin1234', saltRounds);
  const userHash = await bcrypt.hash('user1234', saltRounds);

  db.serialize(() => {
    // usersテーブルの作成
    db.run(`CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_locked INTEGER DEFAULT 0,
      lock_until DATETIME
    )`);
    // messagesテーブルの作成
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_by_sender INTEGER DEFAULT 0,
      deleted_by_admin INTEGER DEFAULT 0,
      FOREIGN KEY (from_user_id) REFERENCES users (user_id),
      FOREIGN KEY (to_user_id) REFERENCES users (user_id)
    )`);

    // テストデータの挿入
    const stmt = db.prepare("INSERT OR REPLACE INTO users (user_id, password_hash, role, is_locked, lock_until) VALUES (?, ?, ?, ?, ?)");
    
    // 管理者アカウント
    stmt.run("admin", adminHash, "ADMIN", 0, null);
    // 一般ユーザーアカウント
    for (let i = 1; i <= 50; i++) {
      stmt.run(`user${i}`, userHash, "USER", 0, null);
    }
    
    stmt.finalize();
    console.log("データベースの初期化が完了しました。");
  });

  db.close();
}

init();