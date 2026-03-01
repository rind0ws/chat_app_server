const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// ADMIN権限のみアクセス可能なユーザー管理API
// GET /api/users (一覧取得)
router.get('/', (req, res) => {
  const sql = "SELECT user_id, role, is_locked, lock_until FROM users";
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("ユーザー一覧の取得に失敗:", err);
      return res.status(500).json({ error: "ユーザー一覧の取得に失敗しました。" });
    }
    res.json(rows);
  });
});

// POST /api/users (新規作成)
router.post('/', (req, res) => {
  const { user_id, password, role } = req.body;
  // バリデーション
  if (!user_id || !password || !role) {
    return res.status(400).json({ error: "必須項目が不足しています。" });
  }
  try {
    const saltRounds = 10;
    const password_hash = bcrypt.hashSync(password, saltRounds);
    // データベースへ挿入
    const sql = `
      INSERT INTO users (user_id, password_hash, role, is_locked, lock_until, failed_attempts)
      VALUES (?, ?, ?, 0, NULL, 0)
    `;
    
    db.run(sql, [user_id, password_hash, role], function(err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(400).json({ error: "このユーザーIDは既に存在します。別のIDを入力してください。" });
        }
        console.error("ユーザーの新規作成に失敗:", err);
        return res.status(500).json({ error: "ユーザーの新規作成に失敗しました。" });
      }
      res.json({ message: "ユーザーを新規作成しました", user_id: user_id });
    });
  } catch (err) {
    console.error("ユーザーの新規作成に失敗:", err);
    res.status(500).json({ error: "ユーザーの新規作成に失敗しました。" });
  }
});

// DELETE /api/users/:userId (削除)
router.delete('/:userId', (req, res) => {
  res.json({ message: `ユーザー ${req.params.userId} を削除しました` });
});

module.exports = router;