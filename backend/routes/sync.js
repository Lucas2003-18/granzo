const express = require("express");
const fs      = require("fs");
const path    = require("path");
const router  = express.Router();

const SNAPSHOT_PATH = path.join(__dirname, "../data/snapshot.json");

router.post("/", (req, res) => {
  try {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify({ ...req.body, updatedAt: new Date().toISOString() }, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao salvar snapshot:", err);
    res.status(500).json({ error: "Falha ao salvar snapshot" });
  }
});

module.exports = router;
