"""Slash commands e envios. Só o DISCORD_OWNER_ID é atendido (SPEC-01 S6)."""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta

import discord
from discord import app_commands

from ..services import reports
from ..services.categorize import normalize
from ..services.categorias_padrao import CATEGORIAS
from ..services.reports import br_date, brl

log = logging.getLogger(__name__)
VERDE, AMBAR, VERMELHO = 0x3DBA6F, 0xE8A832, 0xE05252


def is_owner(user_id: int, owner_id: int) -> bool:
    return user_id == owner_id


class OwnerOnlyTree(app_commands.CommandTree):
    """Qualquer outro usuário é ignorado (resposta efêmera mínima) e logado."""

    def __init__(self, client, owner_id: int):
        super().__init__(client)
        self.owner_id = owner_id

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if is_owner(interaction.user.id, self.owner_id):
            return True
        log.warning("comando negado: user_id=%s cmd=%s", interaction.user.id,
                    getattr(interaction.command, "name", "?"))
        try:
            await interaction.response.send_message("Sem permissão.", ephemeral=True)
        except discord.HTTPException:
            pass
        return False


def daily_embed(d: dict) -> discord.Embed:
    cor = VERDE
    if d["ritmo"]["veredicto"] == "estourando":
        cor = VERMELHO
    embed = discord.Embed(title=d["titulo"], color=cor)
    embed.add_field(name="Gasto do mês", value=brl(d["gasto_mes"]), inline=True)
    embed.add_field(name="Projeção", value=brl(d["ritmo"]["projecao"]), inline=True)
    if d["linhas"]:
        txt = "\n".join(
            f"`{l['data'][:5]}` {l['descricao'][:40]} · {'-' if l['kind']=='exp' else '+'}{brl(l['valor'])} · {l['categoria']}"
            for l in d["linhas"]
        )
        if d["extras"]:
            txt += f"\n+{d['extras']} outras"
        embed.add_field(name="Movimentações novas", value=txt[:1024], inline=False)
    else:
        embed.description = "Sem movimentações novas."
    if d["a_classificar"]:
        embed.add_field(name="A classificar", value=f"{d['a_classificar']} item(ns) — use /categorizar", inline=False)
    if d["desatualizado"]:
        embed.color = AMBAR
        embed.set_footer(text="⚠️ Dados desatualizados (>24h)")
    return embed


async def send_daily(bot, store, channel_id: int, today: date | None, last_sync: str | None,
                     send_when_empty: bool = True) -> bool:
    d = reports.daily(store, today or date.today(), last_sync)
    if not d["linhas"] and not send_when_empty:
        return False
    channel = bot.get_channel(channel_id) or await bot.fetch_channel(channel_id)
    await channel.send(embed=daily_embed(d))
    store.mark_notified(d["ids_para_marcar"])  # só depois de enviar com sucesso
    return True


# ---------------- formatação (pura, testável) ----------------
def fmt_saldo(rows) -> str:
    if not rows:
        return "Nenhuma conta sincronizada ainda."
    linhas = []
    for r in rows:
        rotulo = "Conta corrente" if r["tipo"] == "corrente" else "Cartão (valor da conta no Pluggy)"
        v = brl(r["saldo_atual"]) if r["saldo_atual"] is not None else "—"
        linhas.append(f"**{rotulo}:** {v}")
    return "\n".join(linhas)


def fmt_gastos(rows) -> str:
    if not rows:
        return "Nada encontrado."
    out = []
    for r in rows:
        sinal = "-" if r["kind"] == "exp" else "+"
        cat = f"{r['cat_emoji'] or ''} {r['cat_nome'] or 'A classificar'}".strip()
        out.append(f"`{r['id'][:8]}` {br_date(r['data'])[:5]} {r['descricao'][:32]} · {sinal}{brl(r['valor'])} · {cat}")
    return "\n".join(out)[:1900]


def fmt_resumo(m: dict) -> str:
    y, mo = m["mes"].split("-")
    linhas = [f"**{mo}/{y}** — entradas {brl(m['entradas'])} · saídas {brl(m['saidas'])} · saldo {brl(m['saldo'])}"]
    for c in m["categorias"]:
        var = "" if c["variacao_pct"] is None else f" ({c['variacao_pct']:+.0f}%)"
        linhas.append(f"{c['categoria']}: {brl(c['valor'])}{var}")
    return "\n".join(linhas)


SYNC_COOLDOWN_S = 15 * 60  # Pluggy só atualiza ~24h; evita abuso


def register_commands(tree, store, categorizer, sync_fn, owner_id: int) -> None:
    """Registra os slash commands. Todos ephemeral; o OwnerOnlyTree já barra não-donos."""
    cat_choices = [app_commands.Choice(name=f"{e} {n}", value=i) for i, n, e, _ in CATEGORIAS]
    state: dict = {"last_sync": None}

    @tree.command(name="saldo", description="Saldo da conta e do cartão")
    async def saldo(inter: discord.Interaction):
        await inter.response.send_message(fmt_saldo(store.balances()), ephemeral=True)

    @tree.command(name="resumo", description="Resumo do mês (AAAA-MM ou MM/AAAA)")
    @app_commands.describe(mes="Mês, ex.: 2026-10 ou 10/2026 (padrão: atual)")
    async def resumo(inter: discord.Interaction, mes: str | None = None):
        try:
            ym = reports.parse_month(mes, date.today())
        except ValueError as e:
            return await inter.response.send_message(str(e), ephemeral=True)
        await inter.response.send_message(fmt_resumo(reports.monthly(store, ym)), ephemeral=True)

    @tree.command(name="gastos", description="Lista movimentações filtradas")
    @app_commands.choices(categoria=cat_choices)
    @app_commands.describe(categoria="Categoria (opcional)", dias="Últimos N dias (1-365, padrão 30)")
    async def gastos(inter: discord.Interaction, categoria: app_commands.Choice[str] | None = None,
                     dias: app_commands.Range[int, 1, 365] = 30):
        since = (date.today() - timedelta(days=dias)).isoformat()
        rows = store.list_tx(since, categoria.value if categoria else None)
        await inter.response.send_message(fmt_gastos(rows), ephemeral=True)

    @tree.command(name="categorizar", description="Corrige a categoria e cria regra para o futuro")
    @app_commands.choices(categoria=cat_choices)
    @app_commands.describe(id="Código curto mostrado em /gastos", categoria="Nova categoria")
    async def categorizar(inter: discord.Interaction, id: str, categoria: app_commands.Choice[str]):
        row = store.find_tx(id.strip())
        if not row:
            return await inter.response.send_message("Transação não encontrada (ou código ambíguo).", ephemeral=True)
        desc = store.set_manual_category(row["id"], categoria.value)
        categorizer.learn(desc, categoria.value)
        n = store.apply_rule_to_unclassified(normalize(desc), categoria.value)
        store.conn.commit()
        await inter.response.send_message(
            f"Ok: **{desc[:40]}** → {categoria.name}. Regra criada" + (f"; {n} outra(s) atualizada(s)." if n else "."),
            ephemeral=True)

    @tree.command(name="orcamento", description="Define o limite mensal de uma categoria (0 remove)")
    @app_commands.choices(categoria=cat_choices)
    async def orcamento(inter: discord.Interaction, categoria: app_commands.Choice[str],
                        valor: app_commands.Range[float, 0, 1_000_000]):
        store.set_budget(categoria.value, valor or None)
        msg = f"Limite de {categoria.name}: {brl(valor)}" if valor else f"Limite de {categoria.name} removido."
        await inter.response.send_message(msg, ephemeral=True)

    @tree.command(name="sync", description="Força sincronização agora")
    async def sync(inter: discord.Interaction):
        last = state["last_sync"]
        wait = 0 if last is None else SYNC_COOLDOWN_S - (time.monotonic() - last)
        if wait > 0:
            return await inter.response.send_message(f"Aguarde {int(wait // 60) + 1} min.", ephemeral=True)
        state["last_sync"] = time.monotonic()
        await inter.response.defer(ephemeral=True, thinking=True)
        try:
            r = await sync_fn()
            await inter.followup.send(f"Sincronizado: {r['novas']} nova(s), status {r['status']}.", ephemeral=True)
        except Exception as e:  # mensagem genérica: nada de detalhes/segredos
            log.error("/sync falhou: %s", type(e).__name__)
            await inter.followup.send(f"Falha na sincronização ({type(e).__name__}).", ephemeral=True)
