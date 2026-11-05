"""Detecção de recorrência/assinaturas (SPEC-03): mesma descrição, valor ±5%, >=3 meses seguidos."""
from __future__ import annotations

import re
from collections import defaultdict

from .categorize import normalize
from .store import FORA_DOS_TOTAIS

TOLERANCIA = 0.05
MIN_MESES = 3


def recurrence_key(desc: str) -> str:
    """Descrição sem números/pontuação ('NETFLIX 123' e 'Netflix' são a mesma)."""
    return re.sub(r"\s+", " ", re.sub(r"[\d\W_]+", " ", normalize(desc))).strip()


def _month_index(ym: str) -> int:
    y, m = ym.split("-")
    return int(y) * 12 + int(m)


def detect(conn, ref_ym: str) -> list[dict]:
    """Assinaturas ativas em `ref_ym`: sequência termina em ref_ym ou no mês anterior."""
    rows = conn.execute(
        f"SELECT data, descricao, valor FROM transacoes WHERE kind='exp' AND NOT {FORA_DOS_TOTAIS}"
    ).fetchall()
    groups: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    names: dict[str, str] = {}
    for r in rows:
        k = recurrence_key(r["descricao"])
        if not k:
            continue
        groups[k][r["data"][:7]].append(r["valor"])
        names.setdefault(k, r["descricao"])
    ref = _month_index(ref_ym)
    found = []
    for k, months in groups.items():
        seq = sorted(months)
        run: list[tuple[str, float]] = []
        best: list[tuple[str, float]] = []
        for ym in seq:
            v = sum(months[ym]) / len(months[ym])
            if run and _month_index(ym) == _month_index(run[-1][0]) + 1 \
                    and abs(v - run[-1][1]) <= TOLERANCIA * run[-1][1]:
                run.append((ym, v))
            else:
                run = [(ym, v)]
            if len(run) >= len(best):
                best = list(run)
        if len(best) >= MIN_MESES and ref - _month_index(best[-1][0]) in (0, 1):
            found.append({"chave": k, "descricao": names[k], "valor": best[-1][1], "meses": len(best)})
    return sorted(found, key=lambda x: -x["valor"])
