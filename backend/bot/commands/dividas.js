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

function diasAte(vencimento) {
  if (!vencimento) return null;
  const [d, m, y] = vencimento.split("/");
  if (!d || !m || !y) return null;
  const dt   = new Date(+y, +m - 1, +d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  dt.setHours(0, 0, 0, 0);
  return Math.round((dt - hoje) / 86400000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dividas")
    .setDescription("Lista dívidas pendentes"),

  async execute(interaction) {
    const snap = loadSnapshot();
    if (!snap) return interaction.reply({ content: "❌ Nenhum dado sincronizado ainda.", ephemeral: true });

    const pendentes = (snap.dividas || []).filter(d => d.status === "pendente");
    if (pendentes.length === 0) return interaction.reply({ content: "✅ Nenhuma dívida pendente!", ephemeral: false });

    const totalEmprestei = pendentes.filter(d => d.tipo === "emprestei").reduce((s, d) => s + d.valor, 0);
    const totalDevo      = pendentes.filter(d => d.tipo === "devo").reduce((s, d) => s + d.valor, 0);

    const linhas = pendentes
      .sort((a, b) => {
        const da = diasAte(a.vencimento) ?? 9999;
        const db = diasAte(b.vencimento) ?? 9999;
        return da - db;
      })
      .map(d => {
        const dias = diasAte(d.vencimento);
        const icon = d.tipo === "emprestei" ? "💚" : "❤️";
        let vencInfo = "";
        if (dias !== null) {
          vencInfo = dias < 0 ? ` ⚠️ vencida há ${Math.abs(dias)}d` : dias === 0 ? " ⏰ vence hoje" : ` · vence em ${dias}d`;
        }
        return `${icon} **${d.pessoa}** — ${fmtR(d.valor)}${vencInfo}`;
      }).join("\n");

    await interaction.reply({
      embeds: [{
        title: "🤝 Dívidas pendentes",
        description: linhas,
        fields: [
          { name: "💚 A receber", value: fmtR(totalEmprestei), inline: true },
          { name: "❤️ A pagar",  value: fmtR(totalDevo),      inline: true },
        ],
        color: 0x818cf8,
        timestamp: snap.updatedAt || new Date().toISOString(),
        footer: { text: "Granzo · Controle de dívidas" },
      }],
    });
  },
};
