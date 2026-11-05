import logging

from app.logging_setup import SecretFilter


def _emit(msg, secrets, exc=False):
    f = SecretFilter(secrets)
    try:
        if exc:
            raise RuntimeError(msg)
        raise_ = None
    except RuntimeError:
        import sys
        rec = logging.LogRecord("t", logging.ERROR, "f", 1, "falha", (), sys.exc_info())
    else:
        rec = logging.LogRecord("t", logging.INFO, "f", 1, msg, (), None)
    f.filter(rec)
    return rec


def test_masks_secret_in_message():
    r = _emit("token=SEGREDO123456 ok", ["SEGREDO123456"])
    assert "SEGREDO123456" not in r.msg


def test_masks_secret_in_traceback():
    r = _emit("erro com SEGREDO123456", ["SEGREDO123456"], exc=True)
    assert "SEGREDO123456" not in (r.exc_text or "")


def test_masks_bearer_pattern():
    r = _emit("Authorization: Bearer abcdef1234567890", [])
    assert "abcdef1234567890" not in r.msg
