const express = require('express');
const router = express.Router();

// ADMIN権限のみアクセス可能なユーザー管理API
// GET /api/users (一覧取得)
router.get('/', (req, res) => {
  res.json({ message: "ユーザー一覧を取得しました" });
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