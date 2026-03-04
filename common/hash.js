const crypto = require('crypto');

global.sessions = global.sessions || {};

const authenticate = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ code: "ERR_UNAUTHORIZED" });
  }

  const userId = global.sessions[token];

  if (!userId) {
    // トークンが正しくても、サーバーのメモリに存在しなければセッション切れと判断
    return res.status(401).json({ code: "ERR_INVALID_SESSION" });
  }
  req.myId = userId;
  next();
};

module.exports = authenticate;