"""Cliente Pluggy (somente leitura). TODO que depende da API real está marcado VALIDAR.

Referência: SPEC-02. Doc oficial não estava acessível ao escrever isto (rede da sessão);
confirmar no MCP pluggy-docs antes de ligar em produção.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator
from urllib.parse import parse_qsl, urlparse

import httpx

log = logging.getLogger(__name__)
BASE_URL = "https://api.pluggy.ai"


class PluggyAuthError(Exception):
    """Credencial inválida: alertar, sem retry infinito."""


class PluggyError(Exception):
    pass


class PluggyClient:
    def __init__(self, client_id: str, client_secret: str, *,
                 http: httpx.AsyncClient | None = None, retries: int = 3, backoff: float = 1.0):
        self._id, self._secret = client_id, client_secret
        self._http = http or httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
        self._api_key: str | None = None  # só em memória, nunca persistir
        self._retries, self._backoff = retries, backoff

    async def aclose(self) -> None:
        await self._http.aclose()

    async def authenticate(self) -> None:
        try:
            r = await self._http.post("/auth", json={"clientId": self._id, "clientSecret": self._secret})
        except httpx.HTTPError as e:
            raise PluggyError(f"falha de rede na autenticação: {type(e).__name__}") from None
        if r.status_code in (400, 401, 403):
            raise PluggyAuthError(f"autenticação recusada (HTTP {r.status_code})")
        if r.status_code >= 400:
            raise PluggyError(f"auth HTTP {r.status_code}")
        self._api_key = r.json()["apiKey"]  # VALIDAR nome do campo

    async def _get(self, path: str, params: dict | None = None) -> dict[str, Any]:
        if not self._api_key:
            await self.authenticate()
        last: Exception | None = None
        for attempt in range(self._retries):
            try:
                r = await self._http.get(path, params=params, headers={"X-API-KEY": self._api_key})
                if r.status_code == 403 and attempt == 0:  # apiKey expirou: renova uma vez
                    await self.authenticate()
                    continue
                if r.status_code in (401, 403):
                    raise PluggyAuthError(f"HTTP {r.status_code} em {path}")
                if r.status_code >= 500 or r.status_code == 429:
                    raise PluggyError(f"HTTP {r.status_code}")
                if r.status_code >= 400:
                    raise PluggyError(f"HTTP {r.status_code} em {path}")  # não repete 4xx
                return r.json()
            except PluggyAuthError:
                raise
            except (httpx.HTTPError, PluggyError) as e:
                last = e
                if isinstance(e, PluggyError) and "HTTP 4" in str(e) and "429" not in str(e):
                    raise
                await asyncio.sleep(self._backoff * (2 ** attempt))
        raise PluggyError(f"falhou após {self._retries} tentativas: {last}")

    async def get_item(self, item_id: str) -> dict[str, Any]:
        return await self._get(f"/items/{item_id}")  # VALIDAR p/ MeuPluggy (status/consentimento)

    async def list_accounts(self, item_id: str) -> list[dict[str, Any]]:
        return (await self._get("/accounts", {"itemId": item_id})).get("results", [])

    async def list_bills(self, account_id: str) -> list[dict[str, Any]]:
        # VALIDAR: endpoint de faturas e se MeuPluggy as expõe
        return (await self._get("/bills", {"accountId": account_id})).get("results", [])

    async def iter_transactions(self, account_id: str, date_from: str | None = None,
                                date_to: str | None = None) -> AsyncIterator[dict[str, Any]]:
        """GET /v2/transactions paginado por cursor `next` (opaco).

        date_from=None => todo o histórico (primeira sincronização).
        VALIDAR: nomes dos filtros de data e o formato de `next` (URL vs token).
        """
        params: dict[str, Any] = {"accountId": account_id}
        if date_from:
            params["dateFrom"] = date_from
        if date_to:
            params["dateTo"] = date_to
        seen_cursors: set[str] = set()
        while True:
            page = await self._get("/v2/transactions", params)
            for tx in page.get("results", []):
                yield tx
            nxt = page.get("next")
            if not nxt:
                return
            if nxt in seen_cursors:  # proteção contra loop infinito
                raise PluggyError("cursor repetido na paginação")
            seen_cursors.add(nxt)
            params = self._params_from_next(nxt, account_id)

    @staticmethod
    def _params_from_next(nxt: str, account_id: str) -> dict[str, Any]:
        """Reaproveita o que a API devolveu, sem montar cursor à mão.

        Se `next` for URL, usa só a query dela (e recusa outro host p/ não vazar a apiKey).
        Se for token, envia como `cursor`.
        """
        if nxt.startswith("http"):
            u = urlparse(nxt)
            if u.hostname != "api.pluggy.ai":
                raise PluggyError("`next` aponta para host inesperado")
            return dict(parse_qsl(u.query))
        return {"accountId": account_id, "cursor": nxt}
