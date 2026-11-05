from datetime import date

from app.cogs.finance import is_owner
from app.services import reports
from app.services.migrate_granzo import br_to_iso


def _seed(store, n):
    store.upsert_account({"id": "a", "item_id": "i", "banco": "n", "tipo": "corrente", "nome": "x", "saldo_atual": 0})
    for i in range(n):
        t = {"id": f"x{i}", "data": "2026-10-01", "descricao": f"Loja {i}", "valor": 10.0, "kind": "exp",
             "pendente": 0, "eh_pagamento_fatura": 0}
        store.upsert_transaction(t, "a", "outros", "regra", None)
    store.conn.commit()


def test_daily_caps_lines_but_marks_all(store):
    _seed(store, 20)
    d = reports.daily(store, date(2026, 10, 20), None)
    assert len(d["linhas"]) == 15 and d["extras"] == 5 and len(d["ids_para_marcar"]) == 20


def test_daily_does_not_repeat_after_mark(store):
    _seed(store, 3)
    d = reports.daily(store, date(2026, 10, 20), None)
    assert d["desatualizado"] is True  # sem sync registrado
    store.mark_notified(d["ids_para_marcar"])
    assert reports.daily(store, date(2026, 10, 20), None)["linhas"] == []


def test_daily_not_marked_without_explicit_call(store):
    _seed(store, 2)
    reports.daily(store, date(2026, 10, 20), None)
    assert len(store.unnotified()) == 2


def test_pace_projection():
    p = reports.month_pace(300, date(2026, 10, 10), budget_total=800)
    assert round(p["projecao"]) == 930 and p["veredicto"] == "estourando"


def test_formats():
    assert reports.brl(1234.5) == "R$ 1.234,50"
    assert reports.br_date("2026-10-05") == "05/10/2026"
    assert br_to_iso("05/10/2026") == "2026-10-05"


def test_owner_guard():
    assert is_owner(1, 1) and not is_owner(2, 1)
