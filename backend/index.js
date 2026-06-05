require("dotenv").config();
const express = require("express");
const { startBot } = require("./bot/client");

const app = express();
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────
function auth(req, res, next) {
  const key = (req.headers.authorization || "").replace("Bearer ", "");
  if (key !== process.env.GRANZO_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── Routes ──────────────────────────────────────────────────
app.use("/api/sync",   auth, require("./routes/sync"));
app.use("/api/alert",  auth, require("./routes/alert"));

app.get("/api/health", auth, (req, res) => res.json({ ok: true }));

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Granzo backend rodando na porta ${PORT}`));

startBot().catch(console.error);
