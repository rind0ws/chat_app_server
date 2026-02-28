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
      user_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_locked INTEGER DEFAULT 0,
      lock_until DATETIME,
      failed_attempts INTEGER DEFAULT 0
    )`);

    // テストデータの挿入
    const stmt = db.prepare("INSERT OR REPLACE INTO users (user_id, user_name, password_hash, role) VALUES (?, ?, ?, ?)");
    
    // 管理者アカウント
    stmt.run("admin", "管理者太郎", adminHash, "ADMIN");
    // 一般ユーザーアカウント
    stmt.run("user1", "テスト次郎", userHash, "USER");
    
    stmt.finalize();
    console.log("データベースの初期化が完了しました。");
  });

  db.close();
}

init();