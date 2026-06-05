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
    .setName("resumo")
    .setDescription("Resumo financeiro completo do mês"),

  async execute(interaction) {
    const snap = loadSnapshot();
    if (!snap) return interaction.reply({ content: "❌ Nenhum dado sincronizado ainda.", ephemeral: true });

    const mesFiltro = snap.mesFiltro || "";
    const cats      = snap.cats || [];

    const expsDoMes = (snap.exps || []).filter(e => {
      const p = (e.date || "").split("/");
      if (p.length < 2) return false;
      const anoMes = p.length >= 3 ? `${p[2]}-${p[1]}` : mesFiltro.split("-")[0] + `-${p[1]}`;
      return anoMes === mesFiltro;
    });

    const renda  = expsDoMes.filter(e => e.kind === "inc" && (!e.incType || e.incType === "salario" || e.incType === "extra")).reduce((s, e) => s + e.value, 0);
    const gastos = expsDoMes.filter(e => e.kind === "exp" && e.cat !== "investimento").reduce((s, e) => s + e.value, 0);
    const invest = expsDoMes.filter(e => e.kind === "exp" && e.cat === "investimento").reduce((s, e) => s + e.value, 0);
    const saldo  = renda - gastos;
    const taxa   = renda > 0 ? ((saldo / renda) * 100).toFixed(1) : "0";

    // Top 3 categories
    const porCat = cats
      .filter(c => c.id !== "investimento")
      .map(c => ({
        cat: c,
        total: expsDoMes.filter(e => e.kind === "exp" && e.cat === c.id).reduce((s, e) => s + e.value, 0),
      }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const catLines = porCat.map(x => `${x.cat.emoji} ${x.cat.label}: ${fmtR(x.total)}`).join("\n") || "—";

    const pendentes = (snap.dividas || []).filter(d => d.status === "pendente");
    const dividaInfo = pendentes.length > 0
      ? `${pendentes.length} dívida(s) pendente(s)`
      : "Nenhuma dívida pendente";

    await interaction.reply({
      embeds: [{
        title: `📊 Resumo financeiro — ${mesFiltro}`,
        fields: [
          { name: "💰 Renda",         value: fmtR(renda),   inline: true },
          { name: "💸 Gastos",         value: fmtR(gastos),  inline: true },
          { name: "📈 Saldo",          value: fmtR(saldo),   inline: true },
          { name: "🎯 Taxa poupança",  value: `${taxa}%`,    inline: true },
          { name: "📊 Investimentos",  value: fmtR(invest),  inline: true },
          { name: "🤝 Dívidas",        value: dividaInfo,    inline: true },
          { name: "🏆 Top categorias", value: catLines },
        ],
        color: saldo >= 0 ? 0x4ade80 : 0xf87171,
        timestamp: snap.updatedAt || new Date().toISOString(),
        footer: { text: "Granzo · Resumo completo" },
      }],
    });
  },
};
