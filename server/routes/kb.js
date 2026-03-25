const { Router } = require("express");
const multer = require("multer");
const { all, get, run } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
router.use(authMiddleware);

router.get("/:agentKey", (req, res) => {
  try {
    const rows = all("SELECT id,agent_key,file_name,content_type,uploaded_at FROM agent_kb WHERE agent_key=? ORDER BY uploaded_at", [req.params.agentKey]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar KB." });
  }
});

router.get("/:agentKey/:id/content", (req, res) => {
  try {
    const row = get("SELECT content,content_type FROM agent_kb WHERE id=? AND agent_key=?", [Number(req.params.id), req.params.agentKey]);
    if (!row) return res.status(404).json({ error: "Não encontrado." });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro." });
  }
});

router.post("/:agentKey", upload.single("file"), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Arquivo obrigatório." });

    const ext = file.originalname.split(".").pop().toLowerCase();
    let contentType = "text";
    let content = file.buffer.toString("utf-8");

    if (ext === "pdf") {
      contentType = "pdf";
      content = file.buffer.toString("base64");
    }

    if (req.body.content) {
      content = req.body.content;
      contentType = req.body.contentType || "text";
    }

    const r = run("INSERT INTO agent_kb(agent_key,file_name,content_type,content) VALUES(?,?,?,?)", [req.params.agentKey, file.originalname, contentType, content]);
    const row = get("SELECT id,agent_key,file_name,content_type,uploaded_at FROM agent_kb WHERE id=?", [r.lastInsertRowid]);
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao salvar KB." });
  }
});

router.delete("/:agentKey/:id", (req, res) => {
  try {
    run("DELETE FROM agent_kb WHERE id=? AND agent_key=?", [Number(req.params.id), req.params.agentKey]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao deletar KB." });
  }
});

module.exports = router;
