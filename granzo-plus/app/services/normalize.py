"""Pluggy -> modelo interno (valor positivo + kind). Sinal VALIDAR com dados reais (SPEC-02)."""
from __future__ import annotations

import re
from typing import Any

from .categorize import normalize as norm

_PAG_FATURA = re.compile(
    r"pagamento (de|da) fatura|pagamento recebido|pagamento on.?line|pgto fatura|fatura (cartao|nubank)"
)


def to_account(raw: dict[str, Any], item_id: str, banco: str = "nubank") -> dict[str, Any]:
    t = (raw.get("type") or "").upper()
    return {
        "id": raw["id"], "item_id": item_id, "banco": banco,
        "tipo": "cartao" if t == "CREDIT" else "corrente",
        "nome": raw.get("name") or raw.get("marketingName") or "",
        "saldo_atual": raw.get("balance"),
    }


def to_transaction(raw: dict[str, Any], account_type: str) -> dict[str, Any]:
    """account_type: 'corrente' | 'cartao'.

    Convenção assumida (VALIDAR): `type` DEBIT = saída, CREDIT = entrada, com `amount`
    possivelmente já assinado. Se `type` faltar, usa o sinal do amount.
    Em cartão, compra = saída (despesa); crédito no cartão costuma ser pagamento/estorno.
    """
    amount = float(raw["amount"])
    t = (raw.get("type") or "").upper()
    if t == "DEBIT":
        kind = "exp"
    elif t == "CREDIT":
        kind = "inc"
    else:
        kind = "exp" if amount < 0 else "inc"
    desc = (raw.get("description") or "").strip()
    pag_fatura = bool(_PAG_FATURA.search(norm(desc)))
    return {
        "id": raw["id"],
        "data": str(raw["date"])[:10],
        "descricao": desc,
        "valor": abs(amount),
        "kind": kind,
        "pendente": 1 if (raw.get("status") or "").upper() == "PENDING" else 0,
        "eh_pagamento_fatura": 1 if pag_fatura else 0,
        "pluggy_category": raw.get("category"),
    }
