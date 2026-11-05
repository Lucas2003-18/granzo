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


def parse_month(text: str | None, today: date) -> str:
    """Aceita 'AAAA-MM' ou 'MM/AAAA'; vazio = mês atual. Levanta ValueError."""
    if not text:
        return today.strftime("%Y-%m")
    t = text.strip()
    try:
        if "/" in t:
            m, y = t.split("/")
            d = date(int(y), int(m), 1)
        else:
            y, m = t.split("-")
            d = date(int(y), int(m), 1)
    except ValueError:
        raise ValueError("Use AAAA-MM ou MM/AAAA") from None
    return d.strftime("%Y-%m")


def prev_month(ym: str) -> str:
    y, m = map(int, ym.split("-"))
    return f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"


def monthly(store: Store, ym: str) -> dict:
    cur, prev = store.spend_by_category(ym), dict(store.spend_by_category(prev_month(ym)))
    names = {r["id"]: f"{r['emoji'] or ''} {r['nome']}".strip()
             for r in store.conn.execute("SELECT id,nome,emoji FROM categorias")}
    tot = store.month_totals(ym)
    cats = []
    for cid, val in cur[:8]:
        p = prev.get(cid)
        var = ((val - p) / p * 100) if p else None
        cats.append({"categoria": names.get(cid, cid), "valor": val, "variacao_pct": var})
    return {"mes": ym, "entradas": tot["inc"], "saidas": tot["exp"], "saldo": tot["inc"] - tot["exp"], "categorias": cats}


def top_expenses(store: Store, ym: str, n: int = 5):
    from .store import FORA_DOS_TOTAIS
    return store.conn.execute(
        f"SELECT data,descricao,valor FROM transacoes WHERE kind='exp' AND substr(data,1,7)=? "
        f"AND NOT {FORA_DOS_TOTAIS} ORDER BY valor DESC LIMIT ?", (ym, n)).fetchall()


def reading_sentence(categorias: list[dict]) -> str:
    """Frase de leitura: maior alta percentual entre categorias com base relevante."""
    ups = [c for c in categorias
           if c["variacao_pct"] is not None and c["variacao_pct"] > 0 and c["valor"] >= 50]
    if not ups:
        return "Nenhuma categoria subiu em relação ao mês anterior."
    top = max(ups, key=lambda c: c["variacao_pct"])
    return f"{top['categoria']} subiu {top['variacao_pct']:.0f}% — maior alta do mês."


def monthly_full(store: Store, ym: str) -> dict:
    """E2 completo: base de `monthly` + maiores gastos, assinaturas, estouros e frase."""
    from . import recurrence
    base = monthly(store, ym)
    spent = dict(store.spend_by_category(ym))
    estouros = []
    for c in store.conn.execute("SELECT id,nome,emoji,orcamento_mensal l FROM categorias WHERE orcamento_mensal>0"):
        if spent.get(c["id"], 0) > c["l"]:
            estouros.append({"categoria": f"{c['emoji'] or ''} {c['nome']}".strip(),
                             "gasto": spent[c["id"]], "limite": c["l"]})
    subs = recurrence.detect(store.conn, ym)
    return {**base,
            "maiores": [{"data": br_date(r["data"]), "descricao": r["descricao"], "valor": r["valor"]}
                        for r in top_expenses(store, ym)],
            "assinaturas": subs, "assinaturas_total": sum(s["valor"] for s in subs),
            "estouros": estouros, "leitura": reading_sentence(base["categorias"])}
