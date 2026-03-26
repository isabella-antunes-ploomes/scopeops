const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { supabase } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const pw = req.body.password || "";

    const { data: user, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(401).json({ error: "E-mail não encontrado." });

    const ok = await bcrypt.compare(pw, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta." });

    const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, email: user.email, role: user.role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro interno." });
  }
};
