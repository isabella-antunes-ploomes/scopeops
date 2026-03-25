const { Router } = require("express");
const { all, run } = require("../db");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const router = Router();
router.use(authMiddleware);

router.get("/", (req, res) => {
  try {
    const rows = all("SELECT * FROM agent_configs ORDER BY key");
    const map = {};
    for (const row of rows) map[row.key] = { name: row.name, description: row.description, instructions: row.instructions };
    res.json(map);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar configs." });
  }
});

router.put("/", adminOnly, (req, res) => {
  try {
    const configs = req.body;
    for (const [key, cfg] of Object.entries(configs)) {
      run(
        `INSERT INTO agent_configs(key,name,description,instructions,updated_at) VALUES(?,?,?,?,datetime('now'))
         ON CONFLICT(key) DO UPDATE SET name=?,description=?,instructions=?,updated_at=datetime('now')`,
        [key, cfg.name, cfg.description, cfg.instructions, cfg.name, cfg.description, cfg.instructions]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao salvar configs." });
  }
});

module.exports = router;
