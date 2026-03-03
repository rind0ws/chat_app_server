const crypto = require('crypto');
const SECRET_PASSPHRASE = "secret_password";

const authenticate = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ code: "ERR_UNAUTHORIZED" });
  }

  // 接頭辞を除いたハッシュ部分を取り出す
  const clientHash = token.split('_')[1];
  
  // ユーザーIDはリクエストのクエリやボディから取得（またはトークン自体にIDを含める設計にする）
  const userId = req.query.myId || req.body.from_user_id;

  if (!userId) return next(); // IDが取れない場合は後続の処理に任せる

  // サーバー側で正解のハッシュを再計算
  const validHash = crypto.createHash('sha256')
    .update(userId + SECRET_PASSPHRASE)
    .digest('hex');

  if (clientHash === validHash) {
    next(); // 一致すればOK
  } else {
    res.status(401).json({ code: "ERR_INVALID_SESSION" });
  }
};

module.exports = authenticate;