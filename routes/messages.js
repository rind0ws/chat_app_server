const express = require('express');
const router = express.Router();

// GET /api/messages/:userId (履歴取得)
router.get('/:userId', (req, res) => {
  res.json({ message: `ユーザー ${req.params.userId} のメッセージ履歴を取得しました` });
});

// POST /api/messages (新規メッセージ送信)
router.post('/', (req, res) => {
  res.json({ message: "新しいメッセージを送信しました" });
});

// DELETE /api/messages/:messageId (メッセージ削除)
router.delete('/:messageId', (req, res) => {
  res.json({ message: `メッセージ ${req.params.messageId} を削除しました` });
});

module.exports = router;