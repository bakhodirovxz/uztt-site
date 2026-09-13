const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { sign } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.find("users", (u) => u.email === email);
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
  }
  const token = sign(user);
  res.json({
    token,
    user: { id: user.id, ism: user.ism, email: user.email, role: user.role },
  });
});

module.exports = router;
