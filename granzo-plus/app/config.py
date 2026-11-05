"""Configuração lida do ambiente. Falha cedo se faltar segredo obrigatório."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(RuntimeError):
    pass


def _req(env: dict, name: str) -> str:
    v = (env.get(name) or "").strip()
    if not v:
        raise ConfigError(f"variável obrigatória ausente: {name}")
    return v


def _int(env: dict, name: str, default: int | None = None) -> int:
    raw = (env.get(name) or "").strip()
    if not raw:
        if default is None:
            raise ConfigError(f"variável obrigatória ausente: {name}")
        return default
    try:
        return int(raw)
    except ValueError as e:
        raise ConfigError(f"{name} deve ser inteiro") from e


def read_db_key(env: dict) -> str:
    """Chave do SQLCipher: arquivo (Docker secret) tem prioridade sobre DB_KEY."""
    key_file = (env.get("DB_KEY_FILE") or "").strip()
    if key_file and Path(key_file).is_file():
        key = Path(key_file).read_text().strip()
    else:
        key = (env.get("DB_KEY") or "").strip()
    if len(key) < 32:
        raise ConfigError("chave do banco ausente ou curta demais (mínimo 32 caracteres)")
    return key


@dataclass(frozen=True)
class Config:
    pluggy_client_id: str
    pluggy_client_secret: str
    pluggy_item_id: str
    discord_token: str
    owner_id: int
    guild_id: int | None
    ch_diario: int
    ch_mensal: int | None
    ch_alertas: int | None
    ch_status: int
    db_path: str
    db_key: str
    daily_hour: int
    daily_minute: int
    daily_send_when_empty: bool
    gemini_api_key: str | None

    def secrets(self) -> list[str]:
        """Valores que devem ser mascarados em qualquer log."""
        vals = [self.pluggy_client_id, self.pluggy_client_secret, self.discord_token,
                self.db_key, self.gemini_api_key or ""]
        return [v for v in vals if v]


def load(env: dict | None = None) -> Config:
    env = dict(os.environ if env is None else env)
    opt = lambda n: (_int(env, n) if (env.get(n) or "").strip() else None)  # noqa: E731
    return Config(
        pluggy_client_id=_req(env, "PLUGGY_CLIENT_ID"),
        pluggy_client_secret=_req(env, "PLUGGY_CLIENT_SECRET"),
        pluggy_item_id=_req(env, "PLUGGY_ITEM_ID"),
        discord_token=_req(env, "DISCORD_TOKEN"),
        owner_id=_int(env, "DISCORD_OWNER_ID"),
        guild_id=opt("DISCORD_GUILD_ID"),
        ch_diario=_int(env, "CHANNEL_DIARIO_ID"),
        ch_mensal=opt("CHANNEL_MENSAL_ID"),
        ch_alertas=opt("CHANNEL_ALERTAS_ID"),
        ch_status=_int(env, "CHANNEL_STATUS_ID"),
        db_path=(env.get("DB_PATH") or "/data/granzo-plus.db"),
        db_key=read_db_key(env),
        daily_hour=_int(env, "DAILY_HOUR", 7),
        daily_minute=_int(env, "DAILY_MINUTE", 30),
        daily_send_when_empty=(env.get("DAILY_SEND_WHEN_EMPTY", "true").lower() != "false"),
        gemini_api_key=(env.get("GEMINI_API_KEY") or "").strip() or None,
    )
