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
