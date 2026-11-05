"""Categorização (SPEC-03): manual > regras > cache LLM > LLM > 'A classificar'.

O LLM recebe SOMENTE a descrição normalizada do estabelecimento (SPEC-01 S7).
"""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Awaitable, Callable

from .categorias_padrao import A_CLASSIFICAR, IGNORAR, REGRAS_PADRAO

_COMPILED = [(re.compile(p), cat) for p, cat in REGRAS_PADRAO]
LLMFn = Callable[[dict], Awaitable[str | None]]


def normalize(desc: str) -> str:
    d = unicodedata.normalize("NFD", desc.lower())
    d = "".join(c for c in d if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", d).strip()


def build_llm_payload(desc: str) -> dict:
    """Único dado que sai para o LLM. Sem valor, data ou conta (testado)."""
    return {"descricao": normalize(desc)}


def match_default(desc_norm: str) -> str | None:
    for rx, cat in _COMPILED:
        if rx.search(desc_norm):
            return cat
    return None


def detect_inc_type(desc: str) -> str | None:
    """Versão corrigida de detectIncType do Granzo.

    Diferença deliberada: 'pix recebido'/'transferência recebida' NÃO viram salário
    (bug do legado, ver CONTEXT.md). Ficam None => entram como 'A classificar'.
    """
    d = normalize(desc)
    if re.search(r"salario|pro.?labore|prolabore|pagamento.?folha|holerite", d):
        return "salario"
    if re.search(r"rendimento|juros|dividendo|devolucao.*aplicac|resgate", d):
        return "investimento_ret"
    if re.search(r"reembolso|transferencia.?(enviada|entre)|pix.?enviado|ted.?enviado", d):
        return "transferencia"
    if re.search(r"freelance|freela|comissao|consultor", d):
        return "extra"
    return None


class Categorizer:
    def __init__(self, conn, llm: LLMFn | None = None):
        self.conn = conn
        self.llm = llm

    def _db_rules(self):
        return self.conn.execute(
            "SELECT padrao,tipo,categoria_id FROM regras ORDER BY prioridade, id"
        ).fetchall()

    def by_rules(self, desc: str) -> tuple[str, str] | None:
        """Retorna (categoria_id, origem) ou None."""
        dn = normalize(desc)
        for r in self._db_rules():
            ok = (re.search(r["padrao"], dn) is not None) if r["tipo"] == "regex" \
                else normalize(r["padrao"]) in dn
            if ok:
                return r["categoria_id"], "manual"
        cat = match_default(dn)
        # 'outros' do legado era o fallback; aqui o fallback é A classificar.
        return (cat, "regra") if cat else None

    async def categorize(self, desc: str) -> tuple[str, str]:
        hit = self.by_rules(desc)
        if hit:
            return hit
        dn = normalize(desc)
        row = self.conn.execute(
            "SELECT categoria_id FROM cache_llm WHERE descricao_normalizada=?", (dn,)
        ).fetchone()
        if row:
            return row["categoria_id"], "llm"
        if self.llm:
            try:
                cat = await self.llm(build_llm_payload(desc))
            except Exception:  # LLM fora do ar não derruba o fluxo
                cat = None
            valid = {r["id"] for r in self.conn.execute("SELECT id FROM categorias")}
            if cat and cat in valid and cat != A_CLASSIFICAR:
                self.conn.execute(
                    "INSERT OR REPLACE INTO cache_llm VALUES(?,?,?)",
                    (dn, cat, datetime.now(timezone.utc).isoformat()),
                )
                return cat, "llm"
        return A_CLASSIFICAR, "regra"

    def learn(self, desc: str, categoria_id: str) -> None:
        """/categorizar: corrige uma vez, vale para sempre (regra manual)."""
        self.conn.execute(
            "INSERT INTO regras(padrao,tipo,categoria_id,prioridade,origem) VALUES(?,?,?,10,'manual')",
            (normalize(desc), "contem", categoria_id),
        )


__all__ = ["Categorizer", "normalize", "build_llm_payload", "detect_inc_type", "IGNORAR"]
