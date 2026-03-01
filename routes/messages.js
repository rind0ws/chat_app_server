const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/messages/:userId (履歴取得)
router.get('/:userId', (req, res) => {
  const myId = req.query.myId;
  const targetId = req.params.userId;

  if (!myId) {
    return res.status(400).json([]);
  }

  // データベースからメッセージ履歴を取得
  const sql = `
    SELECT * FROM messages 
    WHERE ((from_user_id = ? AND to_user_id = ?) 
       OR (from_user_id = ? AND to_user_id = ?))
       AND deleted_by_sender = 0
    ORDER BY created_at ASC
  `;
  db.all(sql, [myId, targetId, targetId, myId], (err, rows) => {
if (err) {
      console.error("履歴取得失敗:", err);
      return res.status(500).json([]); // エラー時は空配列を返す
    }
    // rows が null や undefined の場合でも空配列を返すようにする
    res.json(rows || []);
  });
});

// POST /api/messages (新規メッセージ送信)
router.post('/', (req, res) => {
  const { from_user_id, to_user_id, message } = req.body;

  // バリデーション: 1~500文字まで
  if (!message || message.length < 1 || message.length > 500) {
    return res.status(400).json({ error: "メッセージは1文字以上500文字以内で入力してください。" });
  }
  // 禁止ワードのチェック
  const NG_WORDS = ["NGWORD"];
  if (NG_WORDS.some(word => message.includes(word))) {
    return res.status(400).json({ error: "不適切なワードが含まれているため送信できません。" });
  }
  // データベースに新しいメッセージを挿入
  const sql = `
    INSERT INTO messages (from_user_id, to_user_id, message, is_read, deleted_by_sender, deleted_by_admin) 
    VALUES (?, ?, ?, 0, 0, 0)
  `;
  db.run(sql, [from_user_id, to_user_id, message], function(err) {
    if (err) {
      console.error("メッセージ送信エラー:", err);
      return res.status(500).json({ error: "メッセージの送信に失敗しました。" });
    }
    // 新しく生成された ID を返す
    res.json({ message_id: this.lastID, message: "送信完了" });
  });
});

// DELETE /api/messages/:messageId (メッセージ削除)
router.delete('/:messageId', (req, res) => {
  const messageId = req.params.messageId;

  // 物理削除を行う例（要件に応じて deleted_by_sender などのフラグ更新に書き換えも可能）
  const sql = `
    UPDATE messages 
    SET deleted_by_sender = 1 
    WHERE message_id = ?
  `;
  
  db.run(sql, [messageId], function(err) {
    if (err) {
      console.error("メッセージ削除エラー:", err);
      return res.status(500).json({ error: "メッセージの削除に失敗しました。" });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: "削除対象のメッセージが見つかりません。" });
    }

    res.json({ message: "メッセージを削除しました" });
  });
});

module.exports = router;