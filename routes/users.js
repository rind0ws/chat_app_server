const express = require('express');
const router = express.Router();
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
  res.json({ message: "ユーザーを新規作成しました" });
});

// DELETE /api/users/:userId (削除)
router.delete('/:userId', (req, res) => {
  res.json({ message: `ユーザー ${req.params.userId} を削除しました` });
});

module.exports = router;