"""Conexão SQLCipher e schema (SPEC-03). A chave nunca é gravada no banco."""
from __future__ import annotations

from pathlib import Path

from sqlcipher3 import dbapi2 as sqlite

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS contas(
  id TEXT PRIMARY KEY,
  item_id TEXT,
  banco TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente','cartao')),
  nome TEXT,
  saldo_atual REAL,
  atualizado_em TEXT
);

CREATE TABLE IF NOT EXISTS categorias(
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, emoji TEXT, orcamento_mensal REAL
);

CREATE TABLE IF NOT EXISTS transacoes(
  id TEXT PRIMARY KEY,
  conta_id TEXT REFERENCES contas(id),
  data TEXT NOT NULL,                       -- ISO AAAA-MM-DD
  descricao TEXT NOT NULL,
  valor REAL NOT NULL CHECK (valor >= 0),   -- sempre positivo
  kind TEXT NOT NULL CHECK (kind IN ('exp','inc')),
  inc_type TEXT,                            -- salario|extra|transferencia|investimento_ret|NULL
  eh_pagamento_fatura INTEGER NOT NULL DEFAULT 0,
  categoria_id TEXT REFERENCES categorias(id),
  categoria_origem TEXT,                    -- regra|llm|manual|pluggy|migracao
  pendente INTEGER NOT NULL DEFAULT 0,
  notificada INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tx_data ON transacoes(data);
CREATE INDEX IF NOT EXISTS ix_tx_notif ON transacoes(notificada);

CREATE TABLE IF NOT EXISTS regras(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  padrao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('contem','regex')),
  categoria_id TEXT NOT NULL REFERENCES categorias(id),
  prioridade INTEGER NOT NULL DEFAULT 100,
  origem TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS cache_llm(
  descricao_normalizada TEXT PRIMARY KEY, categoria_id TEXT NOT NULL, criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fixas(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, valor REAL, dia INTEGER, categoria_id TEXT
);

CREATE TABLE IF NOT EXISTS credit_card_bills(
  id TEXT PRIMARY KEY,
  conta_id TEXT NOT NULL REFERENCES contas(id),
  fechamento TEXT, vencimento TEXT,
  total REAL, minimo REAL, status TEXT
);

CREATE TABLE IF NOT EXISTS bill_payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transacao_id TEXT NOT NULL REFERENCES transacoes(id),
  bill_id TEXT REFERENCES credit_card_bills(id),
  conta_origem_id TEXT REFERENCES contas(id)
);

CREATE TABLE IF NOT EXISTS execucoes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inicio TEXT NOT NULL, fim TEXT,
  modo TEXT, contas INTEGER DEFAULT 0, novas INTEGER DEFAULT 0,
  status TEXT, erro TEXT
);
"""


def _pragma_key(key: str) -> str:
    # PRAGMA não aceita bind; a chave é validada (sem aspas) antes de interpolar.
    if "'" in key or "\x00" in key:
        raise ValueError("chave do banco contém caracteres inválidos")
    return f"PRAGMA key = '{key}'"


def connect(path: str, key: str) -> sqlite.Connection:
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite.connect(path)
    conn.row_factory = sqlite.Row
    conn.execute(_pragma_key(key))
    # Falha aqui (SQLITE_NOTADB) se a chave estiver errada.
    conn.execute("SELECT count(*) FROM sqlite_master").fetchone()
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init(conn: sqlite.Connection) -> None:
    conn.executescript(SCHEMA)
    conn.execute("INSERT OR IGNORE INTO meta(k,v) VALUES('schema_version', ?)", (str(SCHEMA_VERSION),))
    conn.commit()
