const jwt = require("jsonwebtoken");

function verifyAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return { error: { status: 401, message: "Token não fornecido." } };
  }
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return { user: decoded };
  } catch {
    return { error: { status: 401, message: "Token inválido ou expirado." } };
  }
}

function requireAdmin(user) {
  if (user.role !== "admin") {
    return { error: { status: 403, message: "Acesso restrito a administradores." } };
  }
  return null;
}

module.exports = { verifyAuth, requireAdmin };
