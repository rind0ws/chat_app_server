const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// POST /api/login
router.post('/login', (req, res) => {
  const { user_id, password } = req.body;

  console.log("ID Check:", /^[a-zA-Z0-9]+$/.test(user_id));
  console.log("PW Check:", /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password));

  // 入力内容のバリデーション
  if (
    !user_id || // ユーザーIDが空
    !password || // パスワードが空
    user_id.length > 100 || // ユーザーIDが長すぎる
    !/^[a-zA-Z0-9]+$/.test(user_id) || // ユーザーIDが英数字以外を含む
    password.length > 100 || // パスワードが長すぎる
    !/^[a-zA-Z0-9]+$/.test(password) // パスワードが英数字以外を含む
  ) {
    return res.status(400).json({ error: "入力内容が不正です。" });
  }

  try {
    // sqliteからユーザーを検索
    db.get("SELECT * FROM users WHERE user_id = ?", [user_id], async (err, user) => {

      console.log("ユーザー検索結果:", user); // デバッグ用ログ

      if (err) {
        return res.status(500).json({ error: "データベースエラーが発生しました。" });
      }

      if (!user) {
        return res.status(401).json({ error: "ユーザーIDまたはパスワードが正しくありません。" });
      }

      // アカウントロックの確認
      if (user.is_locked) {
        // TODO: ロック解除期限を過ぎているかどうかの判定を実装
        // TODO: 期限を過ぎている場合は is_locked を0 に更新する処理を実装
        return res.status(403).json({ error: "アカウントがロックされています。" });
      }

      // 暗号化されたパスワードの照合
      // bcrypt.compare(平文パスワード, DBのハッシュ値)
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        // 認証成功：ランダムトークンの生成
        const randomToken = uuidv4();
        const prefix = user.role === 'ADMIN' ? 'adm_' : 'usr_';
        
        // フロントエンドに返すResponseオブジェクト
        res.json({
          token: `${prefix}${randomToken}`,
          Response: {
            user_id: user.user_id,
            user_name: user.user_name,
            role: user.role
          }
        });
      } else {
        // TODO: ログイン失敗回数をカウンし、一定回数で is_locked を 1 に更新する処理を実装
        res.status(401).json({ error: "ユーザーIDまたはパスワードが正しくありません。" });
      }
    });
  } catch (error) {
    res.status(500).json({ error: "サーバーエラーが発生しました。", details: error.message });
  }
});

// POST /api/logout
router.post('/logout', (req, res) => {
  res.json({ message: "ログアウト成功" });
});

module.exports = router;