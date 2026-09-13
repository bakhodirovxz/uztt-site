const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "uztt-dev-secret-CHANGE-IN-PRODUCTION";

function sign(user) {
  return jwt.sign(
    { id: user.id, ism: user.ism, role: user.role },
    SECRET,
    { expiresIn: "12h" }
  );
}

function requireAuth(allowedRoles = null) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Token topilmadi" });
    try {
      const payload = jwt.verify(token, SECRET);
      if (allowedRoles && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: "Ruxsat yo'q" });
      }
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Token yaroqsiz" });
    }
  };
}

module.exports = { sign, requireAuth, SECRET };
