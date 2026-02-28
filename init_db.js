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
      lock_until DATETIME,
      failed_attempts INTEGER DEFAULT 0
    )`);

    // テストデータの挿入
    const stmt = db.prepare("INSERT OR REPLACE INTO users (user_id, password_hash, role, is_locked, lock_until, failed_attempts) VALUES (?, ?, ?, ?, ?, ?)");
    
    // 管理者アカウント
    stmt.run("admin", adminHash, "ADMIN", false, null, 0);
    // 一般ユーザーアカウント
    stmt.run("user1", userHash, "USER", false, null, 0);
    
    stmt.finalize();
    console.log("データベースの初期化が完了しました。");
  });

  db.close();
}

init();