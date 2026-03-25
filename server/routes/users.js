const { Router } = require("express");
const { all, run } = require("../db");
const { authMiddleware, adminOnly } = require("../middleware/auth");

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

router.get("/", (req, res) => {
  try {
    const rows = all("SELECT email,role,created_at FROM users ORDER BY created_at");
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

router.put("/:email/role", (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "common"].includes(role)) return res.status(400).json({ error: "Role inválido." });
    run("UPDATE users SET role=? WHERE email=?", [role, req.params.email.toLowerCase()]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar role." });
  }
});

module.exports = router;
