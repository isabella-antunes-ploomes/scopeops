import { supabase } from "../../_lib/supabase.js";
import { verifyAuth, requireAdmin } from "../../_lib/auth.js";

export default async function handler(req, res) {
  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const adminCheck = requireAdmin(auth.user);
  if (adminCheck) return res.status(adminCheck.error.status).json({ error: adminCheck.error.message });

  const email = decodeURIComponent(req.query.email).toLowerCase();

  try {
    if (req.method === "PUT") {
      const { role } = req.body;
      if (!["admin", "common"].includes(role)) return res.status(400).json({ error: "Role inválido." });

      const { error } = await supabase.from("users").update({ role }).eq("email", email);
      if (error) throw error;
      res.json({ ok: true });

    } else if (req.method === "DELETE") {
      if (email === auth.user.email) return res.status(400).json({ error: "Você não pode remover sua própria conta." });

      await supabase.from("sessions").delete().eq("user_email", email);
      const { error } = await supabase.from("users").delete().eq("email", email);
      if (error) throw error;
      res.json({ ok: true });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar usuário." });
  }
}
