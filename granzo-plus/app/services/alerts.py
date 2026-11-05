"""Alertas (E3, SPEC-04). Uma mensagem consolidada por dia; cada alerta dispara uma vez (chave)."""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from . import recurrence
from .categorize import normalize
from .reports import brl, month_pace
from .store import FORA_DOS_TOTAIS, Store, _now

NEW_ESTAB_LIMIT = 300.0   # estabelecimento novo acima disso é alerta
MIN_HISTORY = 5           # amostras mínimas p/ média+2 desvios
LOOKBACK_DAYS = 180
RECENT_DAYS = 2
STALE_HOURS = 48
PROJECTION_DAYS = (15, 25)


@dataclass(frozen=True)
class Alert:
    kind: str   # fora_padrao|orcamento|assinatura|duplicada|projecao|sync
    key: str
    text: str


def _recent_expenses(conn, today: date):
    since = (today - timedelta(days=RECENT_DAYS)).isoformat()
    return conn.execute(
        f"SELECT id,data,descricao,valor,categoria_id FROM transacoes "
        f"WHERE kind='exp' AND data>=? AND NOT {FORA_DOS_TOTAIS} ORDER BY data,id", (since,)
    ).fetchall()


def outliers(conn, today: date) -> list[Alert]:
    out, recent = [], _recent_expenses(conn, today)
    recent_ids = {r["id"] for r in recent}
    since = (today - timedelta(days=LOOKBACK_DAYS)).isoformat()
    seen = {normalize(r["descricao"]) for r in conn.execute("SELECT descricao,id FROM transacoes") if r["id"] not in recent_ids}
    for t in recent:
        cat = t["categoria_id"]
        if cat and cat != "a_classificar":
            hist = [r["valor"] for r in conn.execute(
                f"SELECT valor FROM transacoes WHERE kind='exp' AND categoria_id=? AND id!=? AND data>=? "
                f"AND NOT {FORA_DOS_TOTAIS}", (cat, t["id"], since))]
            if len(hist) >= MIN_HISTORY:
                mean, sd = statistics.mean(hist), statistics.pstdev(hist)
                if sd > 0 and t["valor"] > mean + 2 * sd:
                    out.append(Alert("fora_padrao", f"fora:{t['id']}",
                                     f"{t['descricao'][:30]} {brl(t['valor'])} — acima do padrão da categoria (média {brl(mean)})"))
                    continue
        if normalize(t["descricao"]) not in seen and t["valor"] >= NEW_ESTAB_LIMIT:
            out.append(Alert("fora_padrao", f"novo:{t['id']}",
                             f"Estabelecimento novo: {t['descricao'][:30]} {brl(t['valor'])}"))
    return out


def duplicates(conn, today: date) -> list[Alert]:
    out, recent = [], _recent_expenses(conn, today)
    for t in recent:
        for o in conn.execute(
            f"SELECT id,data,descricao FROM transacoes WHERE kind='exp' AND id!=? AND valor=? "
            f"AND data BETWEEN ? AND ? AND NOT {FORA_DOS_TOTAIS}",
            (t["id"], t["valor"], (date.fromisoformat(t["data"]) - timedelta(days=1)).isoformat(), t["data"]),
        ):
            if normalize(o["descricao"]) == normalize(t["descricao"]):
                a, b = sorted([t["id"], o["id"]])
                out.append(Alert("duplicada", f"dup:{a}:{b}",
                                 f"Possível cobrança duplicada: {t['descricao'][:30]} {brl(t['valor'])}"))
    return out


def budgets(store: Store, today: date) -> list[Alert]:
    ym, out = today.strftime("%Y-%m"), []
    spent = dict(store.spend_by_category(ym))
    for c in store.conn.execute("SELECT id,nome,emoji,orcamento_mensal l FROM categorias WHERE orcamento_mensal>0"):
        pct = spent.get(c["id"], 0) / c["l"]
        label = f"{c['emoji'] or ''} {c['nome']}".strip()
        if pct >= 1:
            out.append(Alert("orcamento", f"orc100:{c['id']}:{ym}",
                             f"{label} estourou o limite: {brl(spent[c['id']])} de {brl(c['l'])}"))
        elif pct >= 0.8:
            out.append(Alert("orcamento", f"orc80:{c['id']}:{ym}",
                             f"{label} em {pct:.0%} do limite ({brl(spent[c['id']])} de {brl(c['l'])})"))
    return out


def new_subscriptions(conn, today: date) -> list[Alert]:
    return [Alert("assinatura", f"assin:{s['chave']}",
                  f"Assinatura detectada: {s['descricao'][:30]} ~{brl(s['valor'])}/mês ({s['meses']} meses)")
            for s in recurrence.detect(conn, today.strftime("%Y-%m"))]


def projection(store: Store, today: date) -> list[Alert]:
    if today.day not in PROJECTION_DAYS:
        return []
    ym = today.strftime("%Y-%m")
    spent = store.month_totals(ym)["exp"]
    total = store.conn.execute("SELECT SUM(orcamento_mensal) s FROM categorias WHERE orcamento_mensal>0").fetchone()["s"]
    p = month_pace(spent, today, total)
    if total:
        diff = total - p["projecao"]
        txt = (f"No ritmo atual, o mês fecha com sobra de {brl(diff)}" if diff >= 0
               else f"No ritmo atual, o mês fecha com déficit de {brl(-diff)} sobre os limites")
    else:
        txt = f"No ritmo atual, o mês fecha em {brl(p['projecao'])} de gastos"
    return [Alert("projecao", f"proj:{ym}-{today.day}", txt)]


def stale_sync(last_success_iso: str | None, today: date, now: datetime | None = None) -> list[Alert]:
    now = now or datetime.now(timezone.utc)
    if last_success_iso:
        age = now - datetime.fromisoformat(last_success_iso).astimezone(timezone.utc)
        if age < timedelta(hours=STALE_HOURS):
            return []
        txt = f"Sincronização parada há mais de {int(age.total_seconds() // 3600)}h"
    else:
        txt = "Nenhuma sincronização bem-sucedida registrada"
    return [Alert("sync", f"sync:{today.isoformat()}", txt)]


def compute(store: Store, today: date, last_success_iso: str | None, now: datetime | None = None) -> list[Alert]:
    """Todos os alertas aplicáveis que ainda não foram enviados."""
    alerts = (stale_sync(last_success_iso, today, now) + budgets(store, today) + outliers(store.conn, today)
              + duplicates(store.conn, today) + new_subscriptions(store.conn, today) + projection(store, today))
    sent = {r["chave"] for r in store.conn.execute("SELECT chave FROM alertas_enviados")}
    uniq: dict[str, Alert] = {}
    for a in alerts:
        if a.key in sent or a.key in uniq:
            continue
        if a.key.startswith("orc80:") and a.key.replace("orc80", "orc100") in {x.key for x in alerts}:
            continue  # já estourou: só o de 100%
        uniq[a.key] = a
    return list(uniq.values())


def mark_sent(store: Store, alerts: list[Alert]) -> None:
    store.conn.executemany("INSERT OR IGNORE INTO alertas_enviados(chave,enviado_em) VALUES(?,?)",
                           [(a.key, _now()) for a in alerts])
    store.conn.commit()
