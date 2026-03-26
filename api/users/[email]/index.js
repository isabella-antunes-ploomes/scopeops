import { supabase } from "../../_lib/supabase.js";
import { verifyAuth, requireAdmin } from "../../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const adminCheck = requireAdmin(auth.user);
  if (adminCheck) return res.status(adminCheck.error.status).json({ error: adminCheck.error.message });

  try {
    const email = decodeURIComponent(req.query.email).toLowerCase();

    // Don't allow deleting yourself
    if (email === auth.user.email) {
      return res.status(400).json({ error: "Você não pode remover sua própria conta." });
    }

    // Delete user sessions first (foreign key)
    await supabase.from("sessions").delete().eq("user_email", email);

    // Delete user
    const { error } = await supabase.from("users").delete().eq("email", email);
    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao remover usuário." });
  }
}
