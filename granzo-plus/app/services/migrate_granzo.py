"""Importa o backup JSON do Granzo (_version:2) uma única vez (SPEC-03).

O arquivo é fornecido pelo Lucas e NUNCA fica no vault/repo.
VALIDAR: nomes exatos dos campos contra um backup real (assumidos de mf_gastos/mf_cats).
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from .categorize import normalize
from .store import Store

_BR = re.compile(r"^(\d{2})/(\d{2})/(\d{4})$")


def br_to_iso(s: str) -> str:
    m = _BR.match(s.strip())
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    raise ValueError(f"data inválida: {s!r}")


def _tx_id(rec: dict) -> str:
    base = f"{rec.get('data')}|{normalize(str(rec.get('desc','')))}|{rec.get('valor')}|{rec.get('kind')}"
    return "granzo-" + hashlib.sha1(base.encode()).hexdigest()[:16]


def import_backup(store: Store, path: str, conta_id: str = "granzo-legado") -> dict:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("_version") != 2:
        raise ValueError("backup _version:2 esperado")
    store.conn.execute(
        "INSERT OR IGNORE INTO contas(id,banco,tipo,nome) VALUES(?,?,?,?)",
        (conta_id, "granzo", "corrente", "Histórico Granzo"),
    )
    cats = {r["id"] for r in store.conn.execute("SELECT id FROM categorias")}
    novas = ignoradas = 0
    for rec in data.get("gastos", []):  # VALIDAR chave
        try:
            iso = br_to_iso(str(rec["data"]))
        except (KeyError, ValueError):
            ignoradas += 1
            continue
        kind = rec.get("kind", "exp")
        inc_type = rec.get("incType") if kind == "inc" else None
        cat = rec.get("cat") if rec.get("cat") in cats else None
        tx = {"id": _tx_id({**rec, "data": iso}), "data": iso,
              "descricao": str(rec.get("desc", "")), "valor": abs(float(rec.get("valor", 0))),
              "kind": kind, "pendente": 0,
              "eh_pagamento_fatura": 1 if rec.get("cat") == "_ignorar" else 0}
        if store.upsert_transaction(tx, conta_id, cat, "migracao", inc_type):
            novas += 1
        # histórico antigo não deve reaparecer no resumo diário
        store.conn.execute("UPDATE transacoes SET notificada=1 WHERE id=?", (tx["id"],))
    store.conn.commit()
    return {"importadas": novas, "ignoradas": ignoradas}
