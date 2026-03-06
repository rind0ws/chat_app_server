const express = require('express');
const router = express.Router();
const db = require('../database');
const authenticate = require('../common/hash');

// GET /api/messages/unread-counts (全ユーザーの未読数取得)
router.get("/unread-counts/all", authenticate, (req, res) => {
  const myId = req.myId;

  // 自分宛て(to_user_id = myId)の未読があるデータを取得
  const sql = `
    SELECT from_user_id, unread_count
    FROM unreads
    WHERE to_user_id = ? AND unread_count > 0
  `;

  db.all(sql, [myId], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows || []);
  });
});

// GET /api/messages/:userId (履歴取得)
router.get('/:userId', authenticate, (req, res) => {
  const targetId = req.params.userId;
  const myId = req.myId; 
  const { limit = 10, offset = 0 } = req.query;

  db.serialize(() => {
    // 最初の読み込み時に既読更新とサマリーリセット
    if (parseInt(offset) === 0) {
      db.run(
        `UPDATE messages SET is_read = 1 WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0`,
        [targetId, myId]
      );
      db.run(
        `UPDATE unreads SET unread_count = 0, first_unread_id = NULL WHERE to_user_id = ? AND from_user_id = ?`,
        [myId, targetId]
      );
    }

    // データベースからメッセージ履歴を取得
    const sql = `
      SELECT * FROM (
        SELECT * FROM messages 
        WHERE ((from_user_id = ? AND to_user_id = ?) 
          OR (from_user_id = ? AND to_user_id = ?))
          AND deleted_by_sender = 0
          AND deleted_by_admin = 0
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      ) ORDER BY created_at ASC
    `;

    db.all(sql, [myId, targetId, targetId, myId, parseInt(limit), parseInt(offset)], (err, rows) => {
      if (err) return res.status(500).json([]);
      res.json(rows || []);
    });
  });
});

// POST /api/messages (新規メッセージ送信)
router.post("/", authenticate, (req, res) => {
  const from_user_id = req.myId;
  const { to_user_id, message } = req.body;

  // バリデーション: 1~500文字まで
  if (!message || message.length < 1 || message.length > 500) {
    return res.status(400).json({ code: "ERR_INVALID_MESSAGE_LENGTH" });
  }
  // 禁止ワードのチェック
  const NG_WORDS = ["NGWORD"];
  if (NG_WORDS.some(word => message.includes(word))) {
    return res.status(400).json({ code: "ERR_NGWORD_MESSAGE" });
  }

  db.serialize(() => {
    // データベースに新しいメッセージを挿入
    const sql = `
      INSERT INTO messages (from_user_id, to_user_id, message, is_read, deleted_by_sender, deleted_by_admin) 
      VALUES (?, ?, ?, 0, 0, 0)
    `;

    db.run(sql, [from_user_id, to_user_id, message], function (err) {
      if (err) return res.status(500).json({ code: "ERR_MSG_SEND_FAILED" });
      const unreadSql = `
        INSERT INTO unreads (to_user_id, from_user_id, unread_count, first_unread_id)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(to_user_id, from_user_id) DO UPDATE SET
          first_unread_id = CASE WHEN unread_count = 0 THEN excluded.first_unread_id ELSE first_unread_id END,
          unread_count = unread_count + 1
      `;
      db.run(unreadSql, [to_user_id, from_user_id, this.lastID], (err) => {
        if (err) console.error("サマリー更新失敗:", err);
        res.json({ message_id: this.lastID, code: "SUCCESS_MSG_SENT" });
      });
    });
  });
});

// DELETE /api/messages/:messageId (メッセージ削除)
router.delete("/:messageId", authenticate, (req, res) => {
  const messageId = req.params.messageId;
  const myId = req.myId;

  db.serialize(() => {
    const deleteSql = "SELECT from_user_id, to_user_id, is_read FROM messages WHERE message_id = ?"
    db.get(deleteSql), [messageId], (err, msg) => {
      if (err || !msg) {
        return res.status(404).json({ code: "ERR_MSG_NOT_FOUND" });
      }
      // 送信者本人のみ削除可能とする
      if (msg.from_user_id !== myId) {
        return res.status(403).json({ code: "ERR_UNAUTHORIZED_DELETE" });
      }

      // 未読メッセージが削除されるなら、unreadsテーブルを更新
      if (msg.is_read === 0) {
        // 未読件数をデクリメント
        db.run(
          `UPDATE unreads 
            SET unread_count = MAX(0, unread_count - 1) 
            WHERE to_user_id = ? AND from_user_id = ?`,
          [msg.to_user_id, msg.from_user_id]
        );

        // first_unread_id が今回削除されるIDだった場合、次の未読IDを探して更新
        db.run(
          `UPDATE unreads 
            SET first_unread_id = (
              SELECT MIN(message_id) 
              FROM messages 
              WHERE to_user_id = ? AND from_user_id = ? AND is_read = 0 AND message_id <> ?
            )
            WHERE to_user_id = ? AND from_user_id = ? AND first_unread_id = ?`,
          [msg.to_user_id, msg.from_user_id, messageId, msg.to_user_id, msg.from_user_id, messageId]
        );
      }
    };
    const sql = `UPDATE messages SET deleted_by_sender = 1 WHERE message_id = ?`;

    db.run(sql, [messageId], function (err) {
      if (err) {
        return res.status(500).json({ code: "ERR_MSG_DELETE_FAILED" });
      }
      res.json({ code: "SUCCESS_MSG_DELETED" });
    });
  });
});

// DELETE /api/messages (全メッセージ削除 - 管理者用)
router.delete("/", authenticate, (req, res) => {
  db.serialize(() => {
    const sql = `UPDATE messages SET deleted_by_admin = 1`;

    db.run(sql, [], function (err) {
      if (err) {
        return res.status(500).json({ code: "ERR_ALL_MSG_DELETE" });
      }
      res.json({ code: "SUCCESS_ALL_MSG_DELETED", count: this.changes });
    });
  });
});

module.exports = router;