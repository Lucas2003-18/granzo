import httpx
import pytest

from app.services.pluggy import PluggyAuthError, PluggyClient, PluggyError


def client(handler, **kw):
    http = httpx.AsyncClient(base_url="https://api.pluggy.ai", transport=httpx.MockTransport(handler))
    return PluggyClient("id", "secret-value", http=http, backoff=0, **kw)


async def test_pagination_follows_next_and_stops():
    calls = []

    def h(req):
        if req.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "K"})
        calls.append(dict(req.url.params))
        if "cursor" not in req.url.params:
            return httpx.Response(200, json={"results": [{"id": "1"}], "next": "abc"})
        return httpx.Response(200, json={"results": [{"id": "2"}], "next": None})

    c = client(h)
    ids = [t["id"] async for t in c.iter_transactions("acc")]
    assert ids == ["1", "2"]
    assert calls[1]["cursor"] == "abc"


async def test_next_url_other_host_rejected():
    def h(req):
        if req.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "K"})
        return httpx.Response(200, json={"results": [], "next": "https://evil.example/x?a=1"})

    with pytest.raises(PluggyError):
        _ = [t async for t in client(h).iter_transactions("acc")]


async def test_repeated_cursor_aborts():
    def h(req):
        if req.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "K"})
        return httpx.Response(200, json={"results": [], "next": "same"})

    with pytest.raises(PluggyError):
        _ = [t async for t in client(h).iter_transactions("acc")]


async def test_invalid_credentials_raise_auth_error_without_secret():
    def h(req):
        return httpx.Response(401, json={"message": "bad"})

    with pytest.raises(PluggyAuthError) as e:
        await client(h).authenticate()
    assert "secret-value" not in str(e.value)


async def test_retries_5xx_then_succeeds():
    n = {"i": 0}

    def h(req):
        if req.url.path == "/auth":
            return httpx.Response(200, json={"apiKey": "K"})
        n["i"] += 1
        return httpx.Response(500) if n["i"] < 3 else httpx.Response(200, json={"results": [{"id": "a"}]})

    assert await client(h).list_accounts("item") == [{"id": "a"}]


async def test_gives_up_after_retries():
    def h(req):
        return httpx.Response(200, json={"apiKey": "K"}) if req.url.path == "/auth" else httpx.Response(503)

    with pytest.raises(PluggyError):
        await client(h).list_accounts("item")
