import pytest

from app.services.categorize import Categorizer, build_llm_payload, detect_inc_type, normalize


async def test_default_rules(store):
    c = Categorizer(store.conn)
    assert (await c.categorize("IFOOD *Restaurante"))[0] == "alimentacao"
    assert (await c.categorize("Uber *Trip"))[0] == "transporte"
    assert (await c.categorize("Loja Desconhecida XYZ"))[0] == "a_classificar"


async def test_manual_rule_beats_default_and_applies_in_future(store):
    c = Categorizer(store.conn)
    c.learn("Padaria do Zé", "lazer")
    cat, origem = await c.categorize("PADARIA DO ZE - SP")
    assert (cat, origem) == ("lazer", "manual")


async def test_llm_payload_has_only_description():
    p = build_llm_payload("Café Açaí 123 — R$ 45,00")
    assert set(p) == {"descricao"}


async def test_llm_called_with_payload_only_and_cached(store):
    seen = []

    async def llm(payload):
        seen.append(payload)
        return "lazer"

    c = Categorizer(store.conn, llm=llm)
    assert (await c.categorize("Xpto Inedito"))[0] == "lazer"
    assert (await c.categorize("Xpto Inedito"))[0] == "lazer"
    assert len(seen) == 1 and set(seen[0]) == {"descricao"}


async def test_llm_failure_degrades(store):
    async def llm(_):
        raise RuntimeError("boom")

    assert (await Categorizer(store.conn, llm=llm).categorize("Coisa Nova"))[0] == "a_classificar"


async def test_llm_invalid_category_ignored(store):
    async def llm(_):
        return "categoria_inventada"

    assert (await Categorizer(store.conn, llm=llm).categorize("Coisa Nova 2"))[0] == "a_classificar"


def test_pix_recebido_is_not_salario():
    assert detect_inc_type("Pix recebido - Fulano") is None
    assert detect_inc_type("Transferência recebida") is None
    assert detect_inc_type("Salário empresa X") == "salario"
