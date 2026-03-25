const { Router } = require("express");
const { all, get, run } = require("../db");
const { authMiddleware } = require("../middleware/auth");

const router = Router();
router.use(authMiddleware);

router.get("/", (req, res) => {
  try {
    const rows = all("SELECT * FROM sessions WHERE user_email=? ORDER BY started_at ASC", [req.user.email]);
    res.json(rows.map(s => ({ id: s.id, featureName: s.feature_name, startedAt: s.started_at, steps: JSON.parse(s.steps || "[]") })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar sessões." });
  }
});

router.post("/", (req, res) => {
  try {
    const { featureName, steps } = req.body;
    const r = run("INSERT INTO sessions(user_email,feature_name,steps) VALUES(?,?,?)", [req.user.email, featureName, JSON.stringify(steps || [])]);
    const s = get("SELECT * FROM sessions WHERE id=?", [r.lastInsertRowid]);
    res.json({ id: s.id, featureName: s.feature_name, startedAt: s.started_at, steps: JSON.parse(s.steps || "[]") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao criar sessão." });
  }
});

router.put("/:id", (req, res) => {
  try {
    const { steps } = req.body;
    run("UPDATE sessions SET steps=? WHERE id=? AND user_email=?", [JSON.stringify(steps), Number(req.params.id), req.user.email]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar sessão." });
  }
});

router.delete("/:id", (req, res) => {
  try {
    run("DELETE FROM sessions WHERE id=? AND user_email=?", [Number(req.params.id), req.user.email]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao deletar sessão." });
  }
});

module.exports = router;
