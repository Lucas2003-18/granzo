const { SlashCommandBuilder } = require("discord.js");
const fs   = require("fs");
const path = require("path");

const SNAPSHOT = path.join(__dirname, "../../data/snapshot.json");

function fmtR(v) {
  return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadSnapshot() {
  try { return JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")); }
  catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("saldo")
    .setDescription("Mostra saldo do mês atual"),

  async execute(interaction) {
    const snap = loadSnapshot();
    if (!snap) return interaction.reply({ content: "❌ Nenhum dado sincronizado ainda. Abra o app Granzo para sincronizar.", ephemeral: true });

    const mesFiltro = snap.mesFiltro || "";
    const exps = (snap.exps || []).filter(e => {
      const p = (e.date || "").split("/");
      if (p.length < 2) return false;
      const anoMes = p.length >= 3 ? `${p[2]}-${p[1]}` : mesFiltro.split("-")[0] + `-${p[1]}`;
      return anoMes === mesFiltro;
    });

    const renda  = exps.filter(e => e.kind === "inc" && (!e.incType || e.incType === "salario" || e.incType === "extra")).reduce((s, e) => s + e.value, 0);
    const gastos = exps.filter(e => e.kind === "exp" && e.cat !== "investimento").reduce((s, e) => s + e.value, 0);
    const saldo  = renda - gastos;

    await interaction.reply({
      embeds: [{
        title: `💰 Saldo — ${mesFiltro || "período atual"}`,
        fields: [
          { name: "💚 Renda",  value: fmtR(renda),  inline: true },
          { name: "🔴 Gastos", value: fmtR(gastos), inline: true },
          { name: "📊 Saldo",  value: fmtR(saldo),  inline: true },
        ],
        color: saldo >= 0 ? 0x4ade80 : 0xf87171,
        timestamp: snap.updatedAt || new Date().toISOString(),
        footer: { text: "Granzo · Último sync: " + (snap.updatedAt ? new Date(snap.updatedAt).toLocaleString("pt-BR") : "desconhecido") },
      }],
    });
  },
};
