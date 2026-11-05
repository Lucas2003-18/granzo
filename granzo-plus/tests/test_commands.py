from datetime import date
from types import SimpleNamespace

import discord
import pytest
from discord import app_commands

from app.cogs.finance import OwnerOnlyTree, fmt_gastos, fmt_resumo, fmt_saldo, register_commands
from app.services import reports
from app.services.categorize import Categorizer


class FakeResp:
    def __init__(self): self.sent = []
    async def send_message(self, msg, ephemeral=False): self.sent.append((msg, ephemeral))
    async def defer(self, **kw): self.deferred = kw


class FakeFollow:
    def __init__(self): self.sent = []
    async def send(self, msg, ephemeral=False): self.sent.append((msg, ephemeral))


def inter(uid=1):
    return SimpleNamespace(user=SimpleNamespace(id=uid), response=FakeResp(), followup=FakeFollow(), command=None)


def seed(store):
    store.upsert_account({"id": "a", "item_id": "i", "banco": "nubank", "tipo": "corrente", "nome": "Conta", "saldo_atual": 1234.5})
    for i, (d, desc, v, cat) in enumerate([
        ("2026-10-02", "Padaria Zé", 20.0, "a_classificar"),
        ("2026-10-03", "Padaria Zé", 30.0, "a_classificar"),
        ("2026-10-04", "Uber Trip", 15.0, "transporte"),
        ("2026-09-04", "Uber Trip", 10.0, "transporte"),
    ]):
        store.upsert_transaction({"id": f"abcdef{i}0000", "data": d, "descricao": desc, "valor": v, "kind": "exp",
                                  "pendente": 0, "eh_pagamento_fatura": 0}, "a", cat, "regra", None)
    store.conn.commit()


def build(store, sync_fn=None):
    client = discord.Client(intents=discord.Intents.none())
    tree = OwnerOnlyTree(client, 1)

    async def noop():
        return {"novas": 0, "status": "ok"}

    register_commands(tree, store, Categorizer(store.conn), sync_fn or noop, 1)
    return tree, {c.name: c for c in tree.get_commands()}


async def test_all_commands_registered(store):
    _, cmds = build(store)
    assert set(cmds) == {"saldo", "resumo", "gastos", "categorizar", "orcamento", "sync"}


async def test_non_owner_denied_and_owner_allowed(store):
    tree, _ = build(store)
    other = inter(uid=99)
    assert await tree.interaction_check(other) is False
    assert other.response.sent[0][0] == "Sem permissão."
    assert await tree.interaction_check(inter(uid=1)) is True


async def test_saldo_and_gastos_are_ephemeral(store):
    seed(store)
    _, cmds = build(store)
    i = inter()
    await cmds["saldo"].callback(i)
    assert "R$ 1.234,50" in i.response.sent[0][0] and i.response.sent[0][1] is True
    assert "abcdef00" in fmt_gastos(store.list_tx("2026-10-01"))


async def test_categorizar_creates_rule_and_updates_similar(store):
    seed(store)
    _, cmds = build(store)
    i = inter()
    await cmds["categorizar"].callback(i, "abcdef00", app_commands.Choice(name="Lazer", value="lazer"))
    assert i.response.sent[0][1] is True
    assert store.conn.execute("SELECT count(*) FROM transacoes WHERE categoria_id='lazer'").fetchone()[0] == 2
    # futuro: mesma descrição cai na regra manual
    assert (await Categorizer(store.conn).categorize("PADARIA ZE"))[0] == "lazer"


async def test_categorizar_unknown_id(store):
    seed(store)
    _, cmds = build(store)
    i = inter()
    await cmds["categorizar"].callback(i, "zzzz", app_commands.Choice(name="Lazer", value="lazer"))
    assert "não encontrada" in i.response.sent[0][0]


async def test_orcamento_set_and_remove(store):
    _, cmds = build(store)
    await cmds["orcamento"].callback(inter(), app_commands.Choice(name="Lazer", value="lazer"), 350.0)
    assert store.conn.execute("SELECT orcamento_mensal FROM categorias WHERE id='lazer'").fetchone()[0] == 350.0
    await cmds["orcamento"].callback(inter(), app_commands.Choice(name="Lazer", value="lazer"), 0)
    assert store.conn.execute("SELECT orcamento_mensal FROM categorias WHERE id='lazer'").fetchone()[0] is None


async def test_resumo_matches_db_sum_and_variation(store):
    seed(store)
    m = reports.monthly(store, "2026-10")
    assert m["saidas"] == 65.0  # mesma soma do banco
    transp = next(c for c in m["categorias"] if "Transporte" in c["categoria"])
    assert round(transp["variacao_pct"]) == 50  # 10 -> 15
    assert "10/2026" in fmt_resumo(m)
    i = inter()
    await build(store)[1]["resumo"].callback(i, "13/2026")
    assert "AAAA-MM" in i.response.sent[0][0]


async def test_sync_cooldown(store):
    calls = []

    async def fn():
        calls.append(1)
        return {"novas": 2, "status": "ok"}

    _, cmds = build(store, fn)
    a, b = inter(), inter()
    await cmds["sync"].callback(a)
    await cmds["sync"].callback(b)
    assert len(calls) == 1 and "Aguarde" in b.response.sent[0][0]


async def test_sync_failure_message_has_no_details(store):
    async def fn():
        raise RuntimeError("segredo-no-erro")

    _, cmds = build(store, fn)
    i = inter()
    await cmds["sync"].callback(i)
    assert "segredo-no-erro" not in i.followup.sent[0][0]


def test_parse_month():
    t = date(2026, 11, 5)
    assert reports.parse_month(None, t) == "2026-11"
    assert reports.parse_month("10/2026", t) == "2026-10"
    assert reports.parse_month("2026-02", t) == "2026-02"
    assert reports.prev_month("2026-01") == "2025-12"
    with pytest.raises(ValueError):
        reports.parse_month("abc", t)
