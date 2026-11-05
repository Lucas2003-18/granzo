from datetime import date, datetime, timedelta, timezone

import pytest

from app.cogs.finance import alerts_embed, monthly_embed, send_alerts
from app.services import alerts as al
from app.services import recurrence, reports

_n = 0


def tx(store, data, desc, valor, cat="outros", kind="exp", fatura=0, inc_type=None):
    global _n
    _n += 1
    store.upsert_account({"id": "a", "item_id": "i", "banco": "n", "tipo": "corrente", "nome": "x", "saldo_atual": 0})
    store.upsert_transaction({"id": f"id{_n:04d}", "data": data, "descricao": desc, "valor": valor, "kind": kind,
                              "pendente": 0, "eh_pagamento_fatura": fatura}, "a", cat, "regra", inc_type)
    store.conn.commit()
    return f"id{_n:04d}"


# ---- recorrência ----
def test_subscription_needs_3_consecutive_months_within_5pct(store):
    for m, v in [("2026-08", 39.9), ("2026-09", 39.9), ("2026-10", 41.0)]:
        tx(store, f"{m}-05", "NETFLIX.COM 123", v, "lazer")
    s = recurrence.detect(store.conn, "2026-10")
    assert len(s) == 1 and s[0]["meses"] == 3


def test_not_subscription_if_gap_or_value_jump(store):
    for m, v in [("2026-07", 40), ("2026-09", 40), ("2026-10", 40)]:  # buraco em agosto
        tx(store, f"{m}-05", "ACADEMIA X", v)
    for m, v in [("2026-08", 40), ("2026-09", 80), ("2026-10", 40)]:  # salto de valor
        tx(store, f"{m}-06", "RESTAURANTE Y", v)
    assert recurrence.detect(store.conn, "2026-10") == []


def test_stale_subscription_not_reported(store):
    for m in ["2026-05", "2026-06", "2026-07"]:
        tx(store, f"{m}-05", "ANTIGA", 20)
    assert recurrence.detect(store.conn, "2026-10") == []


# ---- mensal ----
def test_monthly_totals_match_db_and_exclude_transfers(store):
    tx(store, "2026-10-02", "Mercado", 100, "alimentacao")
    tx(store, "2026-10-03", "Pagamento de fatura", 900, None, fatura=1, inc_type="transferencia")
    tx(store, "2026-10-04", "Salário", 3000, None, kind="inc", inc_type="salario")
    tx(store, "2026-09-02", "Mercado", 50, "alimentacao")
    m = reports.monthly_full(store, "2026-10")
    assert m["saidas"] == 100 and m["entradas"] == 3000 and m["saldo"] == 2900
    assert "subiu 100%" in m["leitura"]
    assert [x["valor"] for x in m["maiores"]] == [100]


def test_monthly_budget_overrun_listed_and_embed_builds(store):
    tx(store, "2026-10-02", "Cinema", 500, "lazer")  # limite padrão 200
    m = reports.monthly_full(store, "2026-10")
    assert m["estouros"] and m["estouros"][0]["limite"] == 200
    e = monthly_embed(m)
    assert e.title == "Fechamento de 10/2026" and any("Orçamento" in f.name for f in e.fields)


# ---- alertas ----
def test_budget_alert_80_then_100_once_per_month(store):
    today = date(2026, 10, 20)
    tx(store, "2026-10-10", "Cinema", 170, "lazer")  # 85% de 200
    a = al.budgets(store, today)
    assert [x.key for x in a] == ["orc80:lazer:2026-10"]
    tx(store, "2026-10-11", "Show", 60, "lazer")
    keys = [x.key for x in al.compute(store, today, datetime.now(timezone.utc).isoformat())]
    assert "orc100:lazer:2026-10" in keys and "orc80:lazer:2026-10" not in keys


def test_alert_not_repeated_after_mark_sent(store):
    today = date(2026, 10, 20)
    tx(store, "2026-10-10", "Cinema", 250, "lazer")
    ok = datetime.now(timezone.utc).isoformat()
    first = al.compute(store, today, ok)
    assert first
    al.mark_sent(store, first)
    assert al.compute(store, today, ok) == []


def test_outlier_above_mean_plus_2sd(store):
    today = date(2026, 10, 20)
    for i, v in enumerate([40, 42, 38, 41, 39, 43]):
        tx(store, f"2026-09-{i+1:02d}", f"Posto {i}", v, "transporte")
    big = tx(store, "2026-10-20", "Posto Z", 400, "transporte")
    keys = [a.key for a in al.outliers(store.conn, today)]
    assert f"fora:{big}" in keys


def test_new_establishment_over_limit(store):
    tx(store, "2026-09-01", "Padaria", 20, "alimentacao")
    n = tx(store, "2026-10-20", "Loja Nova Cara", 450, "outros")
    assert f"novo:{n}" in [a.key for a in al.outliers(store.conn, date(2026, 10, 20))]


def test_duplicate_charge_within_48h(store):
    a = tx(store, "2026-10-19", "Uber Trip", 23.5, "transporte")
    b = tx(store, "2026-10-20", "UBER TRIP", 23.5, "transporte")
    keys = [x.key for x in al.duplicates(store.conn, date(2026, 10, 20))]
    assert keys == [f"dup:{a}:{b}"]


def test_no_alert_for_fatura_payment_duplicates(store):
    tx(store, "2026-10-19", "Pagamento de fatura", 500, None, fatura=1, inc_type="transferencia")
    tx(store, "2026-10-20", "Pagamento de fatura", 500, None, fatura=1, inc_type="transferencia")
    assert al.duplicates(store.conn, date(2026, 10, 20)) == []


def test_projection_only_days_15_and_25(store):
    tx(store, "2026-10-05", "Mercado", 300, "alimentacao")
    assert al.projection(store, date(2026, 10, 14)) == []
    p = al.projection(store, date(2026, 10, 15))
    assert len(p) == 1 and p[0].key == "proj:2026-10-15"


def test_stale_sync_alert():
    now = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
    old = (now - timedelta(hours=50)).isoformat()
    fresh = (now - timedelta(hours=5)).isoformat()
    assert al.stale_sync(old, date(2026, 10, 20), now)[0].kind == "sync"
    assert al.stale_sync(fresh, date(2026, 10, 20), now) == []
    assert al.stale_sync(None, date(2026, 10, 20), now)


class FakeChannel:
    def __init__(self, fail=False): self.sent, self.fail = [], fail
    async def send(self, **kw):
        if self.fail:
            raise RuntimeError("discord fora")
        self.sent.append(kw)


class FakeBot:
    def __init__(self, ch): self.ch = ch
    def get_channel(self, _): return self.ch


async def test_alerts_single_consolidated_message(store):
    tx(store, "2026-10-10", "Cinema", 250, "lazer")      # orçamento
    tx(store, "2026-10-19", "Uber Trip", 23.5, "transporte")
    tx(store, "2026-10-20", "Uber Trip", 23.5, "transporte")  # duplicada
    ch = FakeChannel()
    ok = datetime.now(timezone.utc).isoformat()
    n = await send_alerts(FakeBot(ch), store, 1, date(2026, 10, 20), ok)
    assert n >= 2 and len(ch.sent) == 1  # UMA mensagem
    assert await send_alerts(FakeBot(ch), store, 1, date(2026, 10, 20), ok) == 0
    assert len(ch.sent) == 1


async def test_alerts_not_marked_if_send_fails(store):
    tx(store, "2026-10-10", "Cinema", 250, "lazer")
    ok = datetime.now(timezone.utc).isoformat()
    with pytest.raises(RuntimeError):
        await send_alerts(FakeBot(FakeChannel(fail=True)), store, 1, date(2026, 10, 20), ok)
    assert store.conn.execute("SELECT count(*) FROM alertas_enviados").fetchone()[0] == 0
    ch = FakeChannel()
    assert await send_alerts(FakeBot(ch), store, 1, date(2026, 10, 20), ok) >= 1  # reenviado depois


def test_reading_sentence_ignores_tiny_categories():
    cats = [{"categoria": "Pet", "valor": 8.0, "variacao_pct": 900.0},
            {"categoria": "Lazer", "valor": 120.0, "variacao_pct": 30.0}]
    assert "Lazer" in reports.reading_sentence(cats)
