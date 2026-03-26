const { supabase } = require("../../_lib/supabase");
const { verifyAuth, requireAdmin } = require("../../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const adminCheck = requireAdmin(auth.user);
  if (adminCheck) return res.status(adminCheck.error.status).json({ error: adminCheck.error.message });

  try {
    const { role } = req.body;
    if (!["admin", "common"].includes(role)) return res.status(400).json({ error: "Role inválido." });

    const email = decodeURIComponent(req.query.email).toLowerCase();
    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("email", email);
    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar role." });
  }
};
