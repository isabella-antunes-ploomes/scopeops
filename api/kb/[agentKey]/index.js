const { supabase } = require("../../_lib/supabase");
const { verifyAuth } = require("../../_lib/auth");

module.exports = async function handler(req, res) {
  const auth = verifyAuth(req);
  if (auth.error) return res.status(auth.error.status).json({ error: auth.error.message });
  const agentKey = req.query.agentKey;

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("agent_kb")
        .select("id, agent_key, file_name, content_type, uploaded_at")
        .eq("agent_key", agentKey)
        .order("uploaded_at");
      if (error) throw error;
      res.json(data);

    } else if (req.method === "POST") {
      const { fileName, content, contentType } = req.body;
      if (!fileName) return res.status(400).json({ error: "fileName obrigatório." });

      let storagePath = null;
      let dbContent = content;

      if (contentType === "pdf" && content) {
        const filePath = `${agentKey}/${Date.now()}_${fileName}`;
        const buffer = Buffer.from(content, "base64");
        const { error: uploadError } = await supabase.storage
          .from("kb-files")
          .upload(filePath, buffer, { contentType: "application/pdf" });
        if (uploadError) throw uploadError;
        storagePath = filePath;
        dbContent = null;
      }

      const { data, error } = await supabase
        .from("agent_kb")
        .insert({
          agent_key: agentKey,
          file_name: fileName,
          content_type: contentType || "text",
          content: dbContent,
          storage_path: storagePath
        })
        .select("id, agent_key, file_name, content_type, uploaded_at")
        .single();
      if (error) throw error;
      res.json(data);

    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao processar KB." });
  }
};
