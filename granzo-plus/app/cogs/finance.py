"""Slash commands e envios. Só o DISCORD_OWNER_ID é atendido (SPEC-01 S6)."""
from __future__ import annotations

import logging
from datetime import date

import discord
from discord import app_commands

from ..services import reports
from ..services.reports import brl

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
