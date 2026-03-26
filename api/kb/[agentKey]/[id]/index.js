import { supabase } from "../../../_lib/supabase.js";
import { verifyAuth } from "../../../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const id = req.query.id;
  const agentKey = req.query.agentKey;

  try {
    const { data: row } = await supabase
      .from("agent_kb")
      .select("storage_path")
      .eq("id", id)
      .eq("agent_key", agentKey)
      .maybeSingle();

    if (row && row.storage_path) {
      await supabase.storage.from("kb-files").remove([row.storage_path]);
    }

    const { error } = await supabase
      .from("agent_kb")
      .delete()
      .eq("id", id)
      .eq("agent_key", agentKey);
    if (error) throw error;

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao deletar KB." });
  }
}
