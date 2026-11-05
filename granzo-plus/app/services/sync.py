"""Orquestra uma sincronização. Falha parcial não cancela as demais contas."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from .categorias_padrao import A_CLASSIFICAR, IGNORAR
from .categorize import Categorizer, detect_inc_type
from .normalize import to_account, to_transaction
from .pluggy import PluggyAuthError, PluggyClient
from .store import Store

log = logging.getLogger(__name__)
WINDOWS = {"diario": 30, "semanal": 90}  # dias; "completo" = sem filtro


def _date_from(mode: str, today: date) -> str | None:
    if mode == "completo":
        return None
    return (today - timedelta(days=WINDOWS[mode])).isoformat()


async def run_sync(client: PluggyClient, store: Store, cat: Categorizer, item_id: str,
                   mode: str | None = None, today: date | None = None) -> dict:
    today = today or date.today()
    mode = mode or ("diario" if store.has_history() else "completo")  # 1ª vez: tudo
    inicio = datetime.now(timezone.utc).isoformat(timespec="seconds")
    novas, ok_accounts, errors = 0, 0, []
    try:
        accounts = await client.list_accounts(item_id)
    except PluggyAuthError as e:
        store.log_run(inicio, datetime.now(timezone.utc).isoformat(timespec="seconds"), mode, 0, 0, "erro_auth", str(e))
        raise
    except Exception as e:
        store.log_run(inicio, datetime.now(timezone.utc).isoformat(timespec="seconds"), mode, 0, 0, "erro", str(e))
        raise

    for raw in accounts:
        acc = to_account(raw, item_id)
        try:
            store.upsert_account(acc)
            async for rtx in client.iter_transactions(acc["id"], _date_from(mode, today)):
                t = to_transaction(rtx, acc["tipo"])
                inc_type = detect_inc_type(t["descricao"]) if t["kind"] == "inc" else None
                if t["eh_pagamento_fatura"]:
                    categoria, origem, inc_type = None, "regra", "transferencia"
                elif t["kind"] == "inc":
                    # Entrada não passa pelas regras de gasto (a regra ^pix é só p/ saída).
                    # Sem tipo reconhecido fica 'a_classificar' (corrige bug Pix->salário).
                    categoria, origem = None, "regra"
                    inc_type = inc_type or "a_classificar"
                else:
                    categoria, origem = await cat.categorize(t["descricao"])
                    if categoria == IGNORAR:  # Pix/TED enviado, transferência entre contas
                        categoria, inc_type = None, "transferencia"
                if store.upsert_transaction(t, acc["id"], categoria, origem, inc_type):
                    novas += 1
            store.conn.commit()
            ok_accounts += 1
        except PluggyAuthError:
            raise
        except Exception as e:
            store.conn.rollback()
            log.error("conta %s falhou: %s", acc["id"], type(e).__name__)
            errors.append(f"{acc['id']}: {type(e).__name__}")

    status = "ok" if not errors else ("parcial" if ok_accounts else "erro")
    store.log_run(inicio, datetime.now(timezone.utc).isoformat(timespec="seconds"), mode,
                  ok_accounts, novas, status, "; ".join(errors) or None)
    return {"mode": mode, "contas_ok": ok_accounts, "novas": novas, "erros": errors, "status": status}
