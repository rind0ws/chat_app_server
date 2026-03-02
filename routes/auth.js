const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// 設定：最大失敗回数とロック時間（分）
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 30;

// POST /api/login
router.post('/login', (req, res) => {
  const { user_id, password } = req.body;

  // 入力内容のバリデーション
  if (
    !user_id || // ユーザーIDが空
    !password || // パスワードが空
    user_id.length > 100 || // ユーザーIDが長すぎる
    !/^[a-zA-Z0-9]+$/.test(user_id) || // ユーザーIDが英数字以外を含む
    password.length > 100 || // パスワードが長すぎる
    !/^[a-zA-Z0-9]+$/.test(password) // パスワードが英数字以外を含む
  ) {
    return res.status(400).json({ code: "ERR_INVALID_INPUT" });
  }

  db.serialize(() => {
    db.get("SELECT * FROM users WHERE user_id = ?", [user_id], async (err, user) => {

      if (err) return res.status(500).json({ code: "ERR_DB_ERROR" });
      if (!user) return res.status(401).json({ code: "ERR_INVALID_CREDENTIALS" });
      const now = new Date();

      // アカウントロックの確認
      if (user.is_locked) {
        if (new Date(user.lock_until) > now) {
          // まだ期限内であればロック継続
          return res.status(423).json({ code: "ERR_ACCOUNT_LOCKED" });
        } else {
          // 期限を過ぎていればロック解除（DB更新）
          db.run("UPDATE users SET is_locked = 0, lock_until = NULL, failed_attempts = 0 WHERE user_id = ?", [user_id]);
          // 処理を続行させるため、この時点でのメモリ上の変数を更新
          user.is_locked = 0;
          user.failed_attempts = 0;
        }
      }

      // 暗号化されたパスワードの照合
      // bcrypt.compare(平文パスワード, DBのハッシュ値)
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        // 認証成功：失敗カウントとロックをリセット
        db.run("UPDATE users SET failed_attempts = 0, is_locked = 0, lock_until = NULL WHERE user_id = ?", [user_id]);
        
        // ランダムトークンの生成
        const randomToken = uuidv4();
        const prefix = user.role === 'ADMIN' ? 'adm_' : 'usr_';
        const fullToken = `${prefix}${randomToken}`;

        // クッキーにトークンをセット
        res.cookie('auth_token', fullToken, {
          httpOnly: false,
          secure: false,
          maxAge: 60 * 60000, // 1時間
          sameSite: 'lax',
          path: '/'
        });

        // レスポンス情報の送信
        res.json({
          Response: {
            user_id: user.user_id,
            role: user.role
          }
        });
      } else {
        const newAttempts = (user.failed_attempts || 0) + 1;
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          // ロック期限を算出（現在時刻 + 30分）
          const lockUntil = new Date(now.getTime() + LOCK_TIME_MINUTES * 60000).toISOString();
          db.run("UPDATE users SET failed_attempts = ?, is_locked = 1, lock_until = ? WHERE user_id = ?", [newAttempts, lockUntil, user_id]);
          
          return res.status(423).json({ code: "ERR_ACCOUNT_LOCKED" });
        } else {
          db.run("UPDATE users SET failed_attempts = ? WHERE user_id = ?", [newAttempts, user_id]);
          res.status(401).json({ code: "ERR_INVALID_CREDENTIALS" });
        }
      }
    });
  });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.json({ code: "SUCCESS_LOGOUT" });
});

module.exports = router;