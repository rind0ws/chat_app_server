const express = require('express');
const router = express.Router();
const db = require('../database');
const authenticate = require('../common/hash');

// GET /api/messages/:userId (履歴取得)
router.get('/:userId', authenticate, (req, res) => {
  const targetId = req.params.userId;
  const { myId, limit = 10, offset = 0 } = req.query;

  if (!myId) {
    return res.status(400).json([]);
  }
  db.serialize(() => {
    const updateSql = `
      UPDATE messages 
      SET is_read = 1 
      WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0
    `;

    db.run(updateSql, [targetId, myId], function(err) {
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
        if (err) {
          return res.status(500).json([]);
        }
        res.json(rows || []);
      });
    });
  });
});

// POST /api/messages (新規メッセージ送信)
router.post("/", authenticate, (req, res) => {
  const { from_user_id, to_user_id, message } = req.body;

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
    db.run("BEGIN TRANSACTION");

    // データベースに新しいメッセージを挿入
    const sql = `
      INSERT INTO messages (from_user_id, to_user_id, message, is_read, deleted_by_sender, deleted_by_admin) 
      VALUES (?, ?, ?, 0, 0, 0)
    `;

    db.run(sql, [from_user_id, to_user_id, message], function (err) {
      if (err) {
        console.error("メッセージ送信エラー:", err);
        db.run("ROLLBACK");
        return res.status(500).json({ code: "ERR_MSG_SEND_FAILED" });
      }
      db.run("COMMIT", (commitErr) => {
        if (commitErr) {
          db.run("ROLLBACK");
          return res.status(500).json({ code: "ERR_TRANSACTION_COMMIT_FAILED" });
        }
        res.json({ message_id: this.lastID, code: "SUCCESS_MSG_SENT" });
      });
    });
  });
});

// DELETE /api/messages/:messageId (メッセージ削除)
router.delete("/:messageId", authenticate, (req, res) => {
  const messageId = req.params.messageId;

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const sql = `UPDATE messages SET deleted_by_sender = 1 WHERE message_id = ?`;

    db.run(sql, [messageId], function (err) {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ code: "ERR_MSG_DELETE_FAILED" });
      }
      
      db.run("COMMIT", (commitErr) => {
        if (commitErr) {
          db.run("ROLLBACK");
          return res.status(500).json({ code: "ERR_TRANSACTION_COMMIT_FAILED" });
        }
        res.json({ code: "SUCCESS_MSG_DELETED" });
      });
    });
  });
});

// DELETE /api/messages (全メッセージ削除 - 管理者用)
router.delete("/", authenticate, (req, res) => {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const sql = `UPDATE messages SET deleted_by_admin = 1`;

    db.run(sql, [], function (err) {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ code: "ERR_ALL_MSG_DELETE" });
      }
      db.run("COMMIT", (commitErr) => {
        if (commitErr) {
          db.run("ROLLBACK");
          return res.status(500).json({ code: "ERR_TRANSACTION_COMMIT_FAILED" });
        }
        res.json({ code: "SUCCESS_ALL_MSG_DELETED", count: this.changes });
      });
    });
  });
});

module.exports = router;