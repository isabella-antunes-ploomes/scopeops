import { supabase } from "../../../_lib/supabase.js";
import { verifyAuth } from "../../../_lib/auth.js";

export default async function handler(req, res) {
  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });

  const id = req.query.id;
  const agentKey = req.query.agentKey;

  try {
    if (req.method === "GET") {
      const { data: row, error } = await supabase
        .from("agent_kb")
        .select("content, content_type, storage_path")
        .eq("id", id)
        .eq("agent_key", agentKey)
        .maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ error: "Não encontrado." });

      if (row.storage_path && row.content_type === "pdf") {
        const { data: fileData, error: dlError } = await supabase.storage
          .from("kb-files")
          .download(row.storage_path);
        if (dlError) throw dlError;
        const buffer = Buffer.from(await fileData.arrayBuffer());
        res.json({ content: buffer.toString("base64"), content_type: "pdf" });
      } else {
        res.json({ content: row.content, content_type: row.content_type });
      }

    } else if (req.method === "DELETE") {
      const { data: row } = await supabase
        .from("agent_kb")
        .select("storage_path")
        .eq("id", id)
        .eq("agent_key", agentKey)
        .maybeSingle();

      if (row && row.storage_path) {
        await supabase.storage.from("kb-files").remove([row.storage_path]);
      }

      const { error } = await supabase.from("agent_kb").delete().eq("id", id).eq("agent_key", agentKey);
      if (error) throw error;
      res.json({ ok: true });

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar KB." });
  }
}
