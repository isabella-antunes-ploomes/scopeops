import { supabase } from "../_lib/supabase.js";
import { verifyAuth, requireAdmin } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const adminCheck = requireAdmin(auth.user);
  if (adminCheck) return res.status(adminCheck.error.status).json({ error: adminCheck.error.message });

  try {
    const { data, error } = await supabase
      .from("users")
      .select("email, role, created_at")
      .order("created_at");
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
}
