const { Router } = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { get, run } = require("../db");

const router = Router();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

function makeToken(email, role) {
  return jwt.sign({ email, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const pw = req.body.password || "";
    if (!email || pw.length < 6) return res.status(400).json({ error: "E-mail e senha (min 6 chars) obrigatórios." });

    const exists = get("SELECT 1 FROM users WHERE email=?", [email]);
    if (exists) return res.status(409).json({ error: "E-mail já cadastrado." });

    const hash = await bcrypt.hash(pw, 10);
    const role = ADMIN_EMAILS.includes(email) ? "admin" : "common";
    run("INSERT INTO users(email,password_hash,role) VALUES(?,?,?)", [email, hash, role]);
    res.json({ token: makeToken(email, role), email, role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro interno." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const pw = req.body.password || "";
    const user = get("SELECT * FROM users WHERE email=?", [email]);
    if (!user) return res.status(401).json({ error: "E-mail não encontrado." });

    const ok = await bcrypt.compare(pw, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta." });

    res.json({ token: makeToken(user.email, user.role), email: user.email, role: user.role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro interno." });
  }
});

module.exports = router;
