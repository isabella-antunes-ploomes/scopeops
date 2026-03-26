import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../_lib/supabase.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const email = (req.body.email || "").toLowerCase().trim();
    const pw = req.body.password || "";
    if (!email || pw.length < 6) return res.status(400).json({ error: "E-mail e senha (min 6 chars) obrigatórios." });

    const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (existing) return res.status(409).json({ error: "E-mail já cadastrado." });

    const hash = await bcrypt.hash(pw, 10);
    const role = ADMIN_EMAILS.includes(email) ? "admin" : "common";

    const { error } = await supabase.from("users").insert({ email, password_hash: hash, role });
    if (error) throw error;

    const token = jwt.sign({ email, role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, email, role });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro interno." });
  }
}
