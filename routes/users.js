const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// ADMIN権限のみアクセス可能なユーザー管理API
// GET /api/users (一覧取得)
router.get('/', (req, res) => {
  const { myId, mode } = req.query;

  let sql = "";
  let params = [];

  if (mode === 'chat') {
    // 【チャット画面】自身と管理者を除外
    sql = `SELECT user_id, role FROM users WHERE role != 'ADMIN' AND user_id != ?`;
    params = [myId];
  } else {
    // 【管理画面】管理者以外の全ユーザーを返す
    sql = `SELECT user_id, role FROM users WHERE role != 'ADMIN'`;
    params = [];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ code: "ERR_USER_FETCH_FAILED" });
    }
    res.json(rows || []);
  });
});

// POST /api/users (新規作成)
router.post('/', (req, res) => {
  const { user_id, password, role } = req.body;

  if (!user_id || !password || !role) {
    return res.status(400).json({ code: "ERR_MISSING_REQUIRED_FIELDS" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ code: "ERR_INTERNAL_SERVER_ERROR" });
      }

      // 2. 制限チェック (50件以上であればエラー)
      if (row.count > 50) {
        db.run("ROLLBACK");
        return res.status(400).json({ code: "ERR_USER_LIMIT_EXCEEDED" });
      }
      try {
        const saltRounds = 10;
        const password_hash = bcrypt.hashSync(password, saltRounds);
        const sql = `
          INSERT INTO users (user_id, password_hash, role, is_locked, lock_until)
          VALUES (?, ?, ?, 0, NULL)
        `;
        
        db.run(sql, [user_id, password_hash, role], function(err) {
          if (err) {
            db.run("ROLLBACK");
            if (err.message.includes("UNIQUE constraint failed")) {
              return res.status(400).json({ code: "ERR_USER_ALREADY_EXISTS" });
            }
            return res.status(500).json({ code: "ERR_USER_CREATE_FAILED" });
          }
          db.run("COMMIT", (commitErr) => {
            if (commitErr) {
              db.run("ROLLBACK");
              return res.status(500).json({ code: "ERR_TRANSACTION_COMMIT_FAILED" });
            }
            res.json({ code: "SUCCESS_USER_CREATED", user_id: user_id });
          });
        });
      } catch (err) {
        db.run("ROLLBACK");
        res.status(500).json({ code: "ERR_INTERNAL_SERVER_ERROR" });
      }
    });
  });
});

// DELETE /api/users/:userId (削除)
router.delete('/:userId', (req, res) => {
  const targetId = req.params.userId;

  // 管理者アカウントを削除不可
  if (targetId === 'admin') {
    return res.status(400).json({ code: "ERR_CANNOT_DELETE_ADMIN" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const sql = "DELETE FROM users WHERE user_id = ?";

    db.run(sql, [targetId], function(err) {
      if (err) {
        return res.status(500).json({ code: "ERR_USER_DELETE_FAILED" });
      }

      db.run("COMMIT", (commitErr) => {
        if (commitErr) {
          db.run("ROLLBACK");
          return res.status(500).json({ code: "ERR_TRANSACTION_COMMIT_FAILED" });
        }
        res.json({ code: "SUCCESS_USER_DELETED" });
      });
    });
  });
});

module.exports = router;