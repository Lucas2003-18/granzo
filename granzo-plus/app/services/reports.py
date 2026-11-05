"""Montagem dos dados dos resumos (puro, testável). Embeds ficam no cog."""
from __future__ import annotations

import calendar
from datetime import date, datetime

from .store import Store

MAX_LINHAS = 15


def br_date(iso: str) -> str:
    return datetime.strptime(iso[:10], "%Y-%m-%d").strftime("%d/%m/%Y")


def brl(v: float) -> str:
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def month_pace(spent: float, today: date, budget_total: float | None = None) -> dict:
    """Projeção do Granzo: média/dia × dias do mês; veredicto 'no ritmo'/'estourando'."""
    dim = calendar.monthrange(today.year, today.month)[1]
    per_day = spent / max(today.day, 1)
    projected = per_day * dim
    verdict = "sem_meta"
    if budget_total:
        verdict = "no_ritmo" if projected <= budget_total else "estourando"
    return {"gasto": spent, "projecao": projected, "dias_restantes": dim - today.day, "veredicto": verdict}


def daily(store: Store, today: date, last_sync_iso: str | None) -> dict:
    """Não marca nada como notificado: quem envia chama mark_notified após sucesso."""
    rows = store.unnotified()
    shown, extra = rows[:MAX_LINHAS], max(len(rows) - MAX_LINHAS, 0)
    ym = today.strftime("%Y-%m")
    totals = store.month_totals(ym)
    budget = store.conn.execute(
        "SELECT SUM(orcamento_mensal) s FROM categorias WHERE orcamento_mensal IS NOT NULL"
    ).fetchone()["s"]
    unclassified = [r for r in rows if (r["categoria_id"] or "") == "a_classificar"
                    or (r["kind"] == "inc" and r["inc_type"] == "a_classificar")]
    stale = False
    if last_sync_iso:
        age = datetime.now().astimezone() - datetime.fromisoformat(last_sync_iso).astimezone()
        stale = age.total_seconds() > 24 * 3600
    else:
        stale = True
    return {
        "titulo": f"Granzo Plus · Resumo de {today.strftime('%d/%m')}",
        "linhas": [{
            "id": r["id"], "data": br_date(r["data"]), "descricao": r["descricao"],
            "valor": r["valor"], "kind": r["kind"],
            "categoria": f"{r['cat_emoji'] or ''} {r['cat_nome'] or 'A classificar'}".strip(),
            "fora_dos_totais": bool(r["eh_pagamento_fatura"] or r["inc_type"] == "transferencia"),
        } for r in shown],
        "extras": extra,
        "ids_para_marcar": [r["id"] for r in rows],  # todas, não só as exibidas
        "a_classificar": len(unclassified),
        "gasto_mes": totals["exp"], "entrada_mes": totals["inc"],
        "ritmo": month_pace(totals["exp"], today, budget),
        "desatualizado": stale,
    }
