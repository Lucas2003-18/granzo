function getWebhook() { try { return localStorage.getItem("mf_discord_webhook") || ""; } catch { return ""; } }

export async function sendWebhook(embeds) {
  const url = getWebhook();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
    });
  } catch {}
}

export function buildOrcamentoEmbed(catLabel, gasto, orcamento, pct) {
  return [{
    title: `💰 Orçamento ${pct >= 100 ? "estourado" : "em alerta"}: ${catLabel}`,
    description: `Gastou **R$ ${gasto.toFixed(2).replace(".", ",")}** de **R$ ${orcamento.toFixed(2).replace(".", ",")}** orçados (${pct.toFixed(0)}%).`,
    color: pct >= 100 ? 0xef4444 : 0xf59e0b,
    timestamp: new Date().toISOString(),
    footer: { text: "Granzo · Alertas financeiros" },
  }];
}

export function buildDividaEmbed(pessoa, valor, tipo, dias) {
  const vencStr = dias < 0 ? `vencida há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;
  return [{
    title: `🤝 Dívida ${tipo === "emprestei" ? "a receber" : "a pagar"}: ${pessoa}`,
    description: `**R$ ${valor.toFixed(2).replace(".", ",")}** — ${vencStr}.`,
    color: tipo === "emprestei" ? 0x4ade80 : 0xf87171,
    timestamp: new Date().toISOString(),
    footer: { text: "Granzo · Lembretes de dívidas" },
  }];
}

export function buildResumoEmbed(renda, gastos, saldo, mes) {
  const taxa = renda > 0 ? ((saldo / renda) * 100).toFixed(1) : "0";
  const r = (v) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  return [{
    title: `📊 Resumo financeiro — ${mes}`,
    fields: [
      { name: "💰 Renda", value: r(renda), inline: true },
      { name: "💸 Gastos", value: r(gastos), inline: true },
      { name: "📈 Saldo", value: r(saldo), inline: true },
      { name: "🎯 Taxa poupança", value: `${taxa}%`, inline: true },
    ],
    color: saldo >= 0 ? 0x4ade80 : 0xf87171,
    timestamp: new Date().toISOString(),
    footer: { text: "Granzo · Resumo automático" },
  }];
}
