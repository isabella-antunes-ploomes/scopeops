import { supabase } from "../_lib/supabase.js";
import { verifyAuth, requireAdmin } from "../_lib/auth.js";

export default async function handler(req, res) {
  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });
  const user = auth.user;

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("agent_configs")
        .select("*")
        .order("key");
      if (error) throw error;

      const map = {};
      for (const row of data) {
        map[row.key] = { name: row.name, description: row.description, instructions: row.instructions };
      }
      res.json(map);

    } else if (req.method === "PUT") {
      const adminCheck = requireAdmin(user);
      if (adminCheck) return res.status(adminCheck.error.status).json({ error: adminCheck.error.message });

      const configs = req.body;
      for (const [key, cfg] of Object.entries(configs)) {
        const { error } = await supabase
          .from("agent_configs")
          .upsert({
            key,
            name: cfg.name,
            description: cfg.description,
            instructions: cfg.instructions,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      res.json({ ok: true });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar configs." });
  }
}
