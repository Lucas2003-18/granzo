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
    .setName("gastos")
    .setDescription("Lista os maiores gastos do mês")
    .addStringOption(opt =>
      opt.setName("categoria")
        .setDescription("Filtrar por categoria (opcional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const snap = loadSnapshot();
    if (!snap) return interaction.reply({ content: "❌ Nenhum dado sincronizado ainda.", ephemeral: true });

    const catFiltro = interaction.options.getString("categoria")?.toLowerCase();
    const mesFiltro = snap.mesFiltro || "";
    const cats      = snap.cats || [];

    const exps = (snap.exps || []).filter(e => {
      if (e.kind !== "exp" || e.cat === "investimento") return false;
      const p = (e.date || "").split("/");
      if (p.length < 2) return false;
      const anoMes = p.length >= 3 ? `${p[2]}-${p[1]}` : mesFiltro.split("-")[0] + `-${p[1]}`;
      if (anoMes !== mesFiltro) return false;
      if (catFiltro) {
        const cat = cats.find(c => c.id === e.cat);
        return (cat?.label || "").toLowerCase().includes(catFiltro) || (e.cat || "").includes(catFiltro);
      }
      return true;
    });

    if (exps.length === 0) return interaction.reply({ content: "Nenhum gasto encontrado para este período.", ephemeral: true });

    const total = exps.reduce((s, e) => s + e.value, 0);
    const top   = [...exps].sort((a, b) => b.value - a.value).slice(0, 8);

    const lines = top.map(e => {
      const cat = cats.find(c => c.id === e.cat);
      return `${cat?.emoji || "📦"} **${e.desc}** — ${fmtR(e.value)} · ${e.date}`;
    }).join("\n");

    await interaction.reply({
      embeds: [{
        title: `💸 Gastos — ${mesFiltro}${catFiltro ? ` · ${catFiltro}` : ""}`,
        description: lines,
        fields: [{ name: "Total", value: fmtR(total), inline: true }],
        color: 0xf87171,
        timestamp: snap.updatedAt || new Date().toISOString(),
        footer: { text: "Granzo · Top 8 maiores gastos" },
      }],
    });
  },
};
