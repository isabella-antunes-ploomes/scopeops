import { supabase } from "../_lib/supabase.js";
import { verifyAuth } from "../_lib/auth.js";

export default async function handler(req, res) {
  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });
  const user = auth.user;
  const id = req.query.id;

  try {
    if (req.method === "PUT") {
      const { steps } = req.body;
      const { error } = await supabase
        .from("sessions")
        .update({ steps })
        .eq("id", id)
        .eq("user_email", user.email);
      if (error) throw error;
      res.json({ ok: true });

    } else if (req.method === "DELETE") {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("id", id)
        .eq("user_email", user.email);
      if (error) throw error;
      res.json({ ok: true });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar sessão." });
  }
}
