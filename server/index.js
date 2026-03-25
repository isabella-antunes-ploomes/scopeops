require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { initDB } = require("./db");

async function start() {
  await initDB();

  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json({ limit: "25mb" }));

  app.use("/api/claude", rateLimit({ windowMs: 60_000, max: 30, message: { error: "Muitas requisições. Aguarde." } }));

  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/sessions", require("./routes/sessions"));
  app.use("/api/agents", require("./routes/agents"));
  app.use("/api/kb", require("./routes/kb"));
  app.use("/api/users", require("./routes/users"));
  app.use("/api/claude", require("./routes/claude"));

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  const clientDist = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(clientDist, "index.html"));
  });

  app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
}

start().catch(e => { console.error("Failed to start:", e); process.exit(1); });
