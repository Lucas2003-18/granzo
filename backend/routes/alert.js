const express    = require("express");
const router     = express.Router();
const { getClient } = require("../bot/client");

function fmtR(v) {
  return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildEmbed(tipo, payload) {
  const ts = new Date().toISOString();
  const footer = { text: "Granzo · Alertas" };

  if (tipo === "orcamento_excedido") {
    const { catLabel, gasto, orcamento, pct } = payload;
    return {
      title: `💰 Orçamento ${pct >= 100 ? "estourado" : "em alerta"}: ${catLabel}`,
      description: `Gastou **${fmtR(gasto)}** de **${fmtR(orcamento)}** orçados (${Number(pct).toFixed(0)}%).`,
      color: pct >= 100 ? 0xef4444 : 0xf59e0b,
      timestamp: ts, footer,
    };
  }

  if (tipo === "divida_vencendo") {
    const { pessoa, valor, tipoDivida, dias } = payload;
    const vencStr = dias < 0 ? `vencida há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;
    return {
      title: `🤝 Dívida ${tipoDivida === "emprestei" ? "a receber" : "a pagar"}: ${pessoa}`,
      description: `**${fmtR(valor)}** — ${vencStr}.`,
      color: tipoDivida === "emprestei" ? 0x4ade80 : 0xf87171,
      timestamp: ts, footer,
    };
  }

  if (tipo === "resumo_diario") {
    const { renda, gastos, saldo, mes, taxaPoupanca } = payload;
    return {
      title: `📊 Resumo — ${mes}`,
      fields: [
        { name: "💰 Renda",          value: fmtR(renda),   inline: true },
        { name: "💸 Gastos",          value: fmtR(gastos),  inline: true },
        { name: "📈 Saldo",           value: fmtR(saldo),   inline: true },
        { name: "🎯 Taxa poupança",   value: `${Number(taxaPoupanca || 0).toFixed(1)}%`, inline: true },
      ],
      color: saldo >= 0 ? 0x4ade80 : 0xf87171,
      timestamp: ts, footer,
    };
  }

  return { title: tipo, description: JSON.stringify(payload), color: 0x818cf8, timestamp: ts, footer };
}

router.post("/", async (req, res) => {
  const { tipo, payload } = req.body;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const client    = getClient();

  if (!client || !channelId) {
    return res.status(503).json({ error: "Bot Discord não configurado" });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error("Canal inválido");
    await channel.send({ embeds: [buildEmbed(tipo, payload)] });
    res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar alerta Discord:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
