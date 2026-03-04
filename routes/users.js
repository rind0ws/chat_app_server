const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const authenticate = require('../common/hash');

// ADMIN権限のみアクセス可能なユーザー管理API
// GET /api/users (一覧取得)
router.get('/', authenticate, (req, res) => {
  const myId = req.myId;
  const { mode } = req.query;

  let sql = (mode === 'chat') 
    ? `SELECT user_id, role FROM users WHERE role != 'ADMIN' AND user_id != ?`
    : `SELECT user_id, role FROM users WHERE role != 'ADMIN'`;
  
  let params = (mode === 'chat') ? [myId] : [];

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows || []);
  });
});

// POST /api/users (新規作成)
router.post('/', authenticate, (req, res) => {
  const { user_id, password, role } = req.body;

  if (!user_id || !password || !role) {
    return res.status(400).json({ code: "ERR_MISSING_REQUIRED_FIELDS" });
  }

  db.serialize(() => {
    try {
      const password_hash = bcrypt.hashSync(password, 10);
      const sql = `
        INSERT INTO users (user_id, password_hash, role, is_locked, lock_until)
        VALUES (?, ?, ?, 0, NULL)
      `;
      
      db.run(sql, [user_id, password_hash, role], function(err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ code: "ERR_USER_ALREADY_EXISTS" });
          }
          return res.status(500).json({ code: "ERR_USER_CREATE_FAILED" });
        }
        res.json({ code: "SUCCESS_USER_CREATED", user_id: user_id });
      });
    } catch (err) {
      res.status(500).json({ code: "ERR_INTERNAL_SERVER_ERROR" });
    }
  });
});

// DELETE /api/users/:userId (削除)
router.delete('/:userId', authenticate, (req, res) => {
  const targetId = req.params.userId;

  // 管理者アカウントを削除不可
  if (targetId === 'admin') {
    return res.status(400).json({ code: "ERR_CANNOT_DELETE_ADMIN" });
  }

  db.serialize(() => {
    const sql = "DELETE FROM users WHERE user_id = ?";

    db.run(sql, [targetId], function(err) {
      if (err) {
        return res.status(500).json({ code: "ERR_USER_DELETE_FAILED" });
      }
      if (this.changes === 0) return res.status(404).json({ code: "ERR_USER_NOT_FOUND" });
      res.json({ code: "SUCCESS_USER_DELETED" });
    });
  });
});

module.exports = router;