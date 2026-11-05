from datetime import date

import httpx

from app.services.categorize import Categorizer
from app.services.pluggy import PluggyClient
from app.services.store import Store
from app.services.sync import run_sync

ACCOUNTS = [
    {"id": "cc", "type": "BANK", "name": "Conta"},
    {"id": "card", "type": "CREDIT", "name": "Cartão"},
]
TX = {
    "cc": [
        {"id": "t1", "description": "Pagamento de fatura", "amount": -500.0, "type": "DEBIT", "date": "2026-10-10T00:00:00Z", "status": "POSTED"},
        {"id": "t2", "description": "Pix recebido Fulano", "amount": 200.0, "type": "CREDIT", "date": "2026-10-11T00:00:00Z", "status": "POSTED"},
        {"id": "t3", "description": "Salário Empresa", "amount": 3000.0, "type": "CREDIT", "date": "2026-10-05T00:00:00Z", "status": "POSTED"},
    ],
    "card": [
        {"id": "c1", "description": "IFOOD", "amount": 50.0, "type": "DEBIT", "date": "2026-10-09T00:00:00Z", "status": "POSTED"},
        {"id": "c2", "description": "Pagamento recebido", "amount": 500.0, "type": "CREDIT", "date": "2026-10-10T00:00:00Z", "status": "POSTED"},
    ],
}


def make(fail_card=False):
    def h(req):
        p = req.url.path
        if p == "/auth":
            return httpx.Response(200, json={"apiKey": "K"})
        if p == "/accounts":
            return httpx.Response(200, json={"results": ACCOUNTS})
        acc = req.url.params["accountId"]
        if fail_card and acc == "card":
            return httpx.Response(400)
        return httpx.Response(200, json={"results": TX[acc], "next": None})

    http = httpx.AsyncClient(base_url="https://api.pluggy.ai", transport=httpx.MockTransport(h))
    return PluggyClient("i", "s", http=http, backoff=0)


async def test_sync_idempotent_and_no_double_count(store):
    cat = Categorizer(store.conn)
    c = make()
    r1 = await run_sync(c, store, cat, "item", today=date(2026, 10, 20))
    assert r1["mode"] == "completo" and r1["novas"] == 5
    r2 = await run_sync(c, store, cat, "item", today=date(2026, 10, 20))
    assert r2["mode"] == "diario" and r2["novas"] == 0
    n = store.conn.execute("SELECT count(*) FROM transacoes").fetchone()[0]
    assert n == 5
    tot = store.month_totals("2026-10")
    # gasto = só a compra de 50; pagamento de fatura (nos dois lados) fora dos totais
    assert tot["exp"] == 50.0
    # renda = salário 3000 + pix 200 (a classificar, ainda conta); pagamento recebido no cartão fora
    assert tot["inc"] == 3200.0


async def test_pix_recebido_needs_classification(store):
    await run_sync(make(), store, Categorizer(store.conn), "item", today=date(2026, 10, 20))
    row = store.conn.execute("SELECT inc_type FROM transacoes WHERE id='t2'").fetchone()
    assert row["inc_type"] == "a_classificar"


async def test_partial_failure_keeps_other_accounts(store):
    r = await run_sync(make(fail_card=True), store, Categorizer(store.conn), "item", today=date(2026, 10, 20))
    assert r["status"] == "parcial" and r["contas_ok"] == 1
    assert store.conn.execute("SELECT count(*) FROM transacoes WHERE conta_id='cc'").fetchone()[0] == 3


async def test_manual_category_survives_resync(store):
    cat = Categorizer(store.conn)
    c = make()
    await run_sync(c, store, cat, "item", today=date(2026, 10, 20))
    store.set_manual_category("c1", "lazer")
    await run_sync(c, store, cat, "item", today=date(2026, 10, 20))
    row = store.conn.execute("SELECT categoria_id,categoria_origem FROM transacoes WHERE id='c1'").fetchone()
    assert (row[0], row[1]) == ("lazer", "manual")
