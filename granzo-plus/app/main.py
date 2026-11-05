"""Bot Discord + scheduler. Só conexões de saída; nenhuma porta é aberta."""
from __future__ import annotations

import asyncio
import logging

import discord
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from . import config as cfgmod
from . import db, logging_setup
from .cogs.finance import OwnerOnlyTree, send_daily
from .services.categorize import Categorizer
from .services.pluggy import PluggyAuthError, PluggyClient
from .services.store import Store
from .services.sync import run_sync

log = logging.getLogger("granzo_plus")
TZ = "America/Sao_Paulo"


async def notify_status(bot, cfg, text: str) -> None:
    try:
        ch = bot.get_channel(cfg.ch_status) or await bot.fetch_channel(cfg.ch_status)
        await ch.send(text)
    except Exception:
        log.error("não foi possível avisar #status")


async def job_daily(bot, cfg, store, client, cat) -> None:
    try:
        await run_sync(client, store, cat, cfg.pluggy_item_id)
    except PluggyAuthError:
        await notify_status(bot, cfg, "🔴 Pluggy recusou a autenticação. Verifique as credenciais.")
    except Exception as e:  # degrada: envia o que existe, avisando que está desatualizado
        log.error("sync falhou: %s", type(e).__name__)
        await notify_status(bot, cfg, f"🟠 Sincronização falhou ({type(e).__name__}). Resumo usa dados antigos.")
    await send_daily(bot, store, cfg.ch_diario, None, store.last_success(), cfg.daily_send_when_empty)


def main() -> None:
    cfg = cfgmod.load()
    logging_setup.setup(cfg.secrets())
    store = Store(db.connect(cfg.db_path, cfg.db_key))
    cat = Categorizer(store.conn)
    client = PluggyClient(cfg.pluggy_client_id, cfg.pluggy_client_secret)

    intents = discord.Intents.none()
    bot = discord.Client(intents=intents)
    bot.tree = OwnerOnlyTree(bot, cfg.owner_id)  # type: ignore[assignment]
    sched = AsyncIOScheduler(timezone=TZ)

    @bot.event
    async def on_ready():
        if not sched.running:
            sched.add_job(job_daily, CronTrigger(hour=cfg.daily_hour, minute=cfg.daily_minute, timezone=TZ),
                          args=[bot, cfg, store, client, cat], id="diario", misfire_grace_time=3600)
            sched.start()
        log.info("online; diário às %02d:%02d", cfg.daily_hour, cfg.daily_minute)

    # TODO(Sprint 4): registrar /saldo /resumo /gastos /categorizar /orcamento /sync em bot.tree

    bot.run(cfg.discord_token, log_handler=None)


if __name__ == "__main__":
    main()
