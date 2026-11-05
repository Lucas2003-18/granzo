"""Logging com máscara de segredos (SPEC-01 S3)."""
from __future__ import annotations

import logging
import re

MASK = "***"
_GENERIC = re.compile(r"(?i)(bearer\s+|x-api-key['\"=:\s]+|apikey['\"=:\s]+|clientsecret['\"=:\s]+)([A-Za-z0-9._\-]{8,})")


class SecretFilter(logging.Filter):
    def __init__(self, secrets: list[str] | None = None):
        super().__init__()
        self._secrets = sorted({s for s in (secrets or []) if s}, key=len, reverse=True)

    def scrub(self, text: str) -> str:
        for s in self._secrets:
            text = text.replace(s, MASK)
        return _GENERIC.sub(lambda m: m.group(1) + MASK, text)

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self.scrub(record.getMessage())
        record.args = ()
        if record.exc_info:  # traceback também pode conter segredo
            record.exc_text = self.scrub(logging.Formatter().formatException(record.exc_info))
            record.exc_info = None
        return True


def setup(secrets: list[str] | None = None, level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    handler.addFilter(SecretFilter(secrets))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # URLs podem ter query sensível
