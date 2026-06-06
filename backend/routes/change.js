const express = require("express");
const fs      = require("fs");
const path    = require("path");
const router  = express.Router();

const CHANGELOG_PATH = path.join(__dirname, "../data/changelog.json");

function loadChangelog() {
  try { return JSON.parse(fs.readFileSync(CHANGELOG_PATH, "utf8")); }
  catch { return []; }
}

function appendChangelog(entrada) {
  const log = loadChangelog();
  log.push(entrada);
  // Mantém apenas os últimos 1000 eventos
  const trimmed = log.slice(-1000);
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(trimmed, null, 2));
}

async function forwardToVault(entrada) {
  const url = process.env.VAULT_URL;
  const key = process.env.VAULT_KEY;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "Authorization": `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ source: "granzo", ...entrada }),
    });
  } catch (err) {
    console.error("Erro ao enviar ao vault:", err.message);
  }
}

router.post("/", async (req, res) => {
  const { eventos } = req.body;
  if (!Array.isArray(eventos) || eventos.length === 0) {
    return res.status(400).json({ error: "eventos deve ser um array não-vazio" });
  }

  const entrada = {
    timestamp: new Date().toISOString(),
    eventos,
  };

  try {
    appendChangelog(entrada);
    forwardToVault(entrada).catch(() => {}); // dispara sem bloquear
    res.json({ ok: true, count: eventos.length });
  } catch (err) {
    console.error("Erro ao salvar changelog:", err);
    res.status(500).json({ error: "Falha ao registrar mudanças" });
  }
});

// GET /api/change — consulta o changelog local
router.get("/", (req, res) => {
  const limit  = Math.min(+(req.query.limit  || 50), 200);
  const offset = +(req.query.offset || 0);
  const log    = loadChangelog();
  res.json({
    total: log.length,
    items: log.slice(-(offset + limit), log.length - offset || undefined).reverse(),
  });
});

module.exports = router;
