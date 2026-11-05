"""Persistência: upsert idempotente, consultas e anti-dupla-contagem."""
from __future__ import annotations

from datetime import datetime, timezone

from ..db import init
from .categorias_padrao import CATEGORIAS

# Excluído de gasto e renda: transferências e pagamento de fatura.
FORA_DOS_TOTAIS = "(COALESCE(inc_type,'') = 'transferencia' OR eh_pagamento_fatura = 1)"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, conn):
        self.conn = conn
        init(conn)
        conn.executemany(
            "INSERT OR IGNORE INTO categorias(id,nome,emoji,orcamento_mensal) VALUES(?,?,?,?)", CATEGORIAS
        )
        conn.commit()

    def upsert_account(self, a: dict) -> None:
        self.conn.execute(
            """INSERT INTO contas(id,item_id,banco,tipo,nome,saldo_atual,atualizado_em)
               VALUES(:id,:item_id,:banco,:tipo,:nome,:saldo_atual,:ts)
               ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, saldo_atual=excluded.saldo_atual,
                 tipo=excluded.tipo, atualizado_em=excluded.atualizado_em""",
            {**a, "ts": _now()},
        )

    def upsert_transaction(self, t: dict, conta_id: str, categoria_id: str | None,
                           origem: str, inc_type: str | None) -> bool:
        """True se for nova. Preserva categoria manual e `notificada` em re-sync."""
        existed = self.conn.execute("SELECT 1 FROM transacoes WHERE id=?", (t["id"],)).fetchone()
        self.conn.execute(
            """INSERT INTO transacoes(id,conta_id,data,descricao,valor,kind,inc_type,eh_pagamento_fatura,
                 categoria_id,categoria_origem,pendente,criado_em)
               VALUES(:id,:conta,:data,:descricao,:valor,:kind,:inc,:pag,:cat,:orig,:pendente,:ts)
               ON CONFLICT(id) DO UPDATE SET
                 data=excluded.data, descricao=excluded.descricao, valor=excluded.valor,
                 kind=excluded.kind, pendente=excluded.pendente,
                 eh_pagamento_fatura=excluded.eh_pagamento_fatura,
                 inc_type=CASE WHEN transacoes.categoria_origem='manual' THEN transacoes.inc_type
                               ELSE excluded.inc_type END,
                 categoria_id=CASE WHEN transacoes.categoria_origem='manual' THEN transacoes.categoria_id
                                   ELSE excluded.categoria_id END,
                 categoria_origem=CASE WHEN transacoes.categoria_origem='manual' THEN 'manual'
                                       ELSE excluded.categoria_origem END""",
            {**t, "conta": conta_id, "inc": inc_type, "pag": t["eh_pagamento_fatura"],
             "cat": categoria_id, "orig": origem, "ts": _now()},
        )
        return existed is None

    def set_manual_category(self, tx_id: str, categoria_id: str) -> str | None:
        """Retorna a descrição (para criar regra) ou None se não existir."""
        row = self.conn.execute("SELECT descricao FROM transacoes WHERE id=?", (tx_id,)).fetchone()
        if not row:
            return None
        self.conn.execute(
            "UPDATE transacoes SET categoria_id=?, categoria_origem='manual' WHERE id=?",
            (categoria_id, tx_id),
        )
        return row["descricao"]

    def apply_rule_to_unclassified(self, desc_norm: str, categoria_id: str) -> int:
        from .categorize import normalize
        n = 0
        for r in self.conn.execute(
            "SELECT id,descricao FROM transacoes WHERE categoria_id='a_classificar'"
        ).fetchall():
            if desc_norm in normalize(r["descricao"]):
                self.conn.execute(
                    "UPDATE transacoes SET categoria_id=?, categoria_origem='manual' WHERE id=?",
                    (categoria_id, r["id"]),
                )
                n += 1
        return n

    # --- consultas ---
    def month_totals(self, ym: str) -> dict:
        """ym = 'AAAA-MM'. Exclui transferências e pagamento de fatura."""
        rows = self.conn.execute(
            f"""SELECT kind, COALESCE(SUM(valor),0) s FROM transacoes
                WHERE substr(data,1,7)=? AND NOT {FORA_DOS_TOTAIS} GROUP BY kind""",
            (ym,),
        ).fetchall()
        d = {r["kind"]: r["s"] for r in rows}
        return {"exp": d.get("exp", 0.0), "inc": d.get("inc", 0.0)}

    def spend_by_category(self, ym: str) -> list[tuple[str, float]]:
        rows = self.conn.execute(
            f"""SELECT COALESCE(categoria_id,'a_classificar') c, SUM(valor) s FROM transacoes
                WHERE substr(data,1,7)=? AND kind='exp' AND NOT {FORA_DOS_TOTAIS}
                GROUP BY c ORDER BY s DESC""",
            (ym,),
        ).fetchall()
        return [(r["c"], r["s"]) for r in rows]

    def unnotified(self):
        return self.conn.execute(
            "SELECT t.*, c.nome cat_nome, c.emoji cat_emoji FROM transacoes t "
            "LEFT JOIN categorias c ON c.id=t.categoria_id "
            "WHERE t.notificada=0 AND t.pendente=0 ORDER BY t.data, t.criado_em"
        ).fetchall()

    def mark_notified(self, ids: list[str]) -> None:
        self.conn.executemany("UPDATE transacoes SET notificada=1 WHERE id=?", [(i,) for i in ids])
        self.conn.commit()

    def log_run(self, inicio: str, fim: str, modo: str, contas: int, novas: int,
                status: str, erro: str | None) -> None:
        self.conn.execute(
            "INSERT INTO execucoes(inicio,fim,modo,contas,novas,status,erro) VALUES(?,?,?,?,?,?,?)",
            (inicio, fim, modo, contas, novas, status, erro),
        )
        self.conn.commit()

    def last_success(self) -> str | None:
        r = self.conn.execute(
            "SELECT fim FROM execucoes WHERE status IN ('ok','parcial') ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return r["fim"] if r else None

    def has_history(self) -> bool:
        return self.conn.execute("SELECT 1 FROM execucoes WHERE status IN ('ok','parcial') LIMIT 1").fetchone() is not None
