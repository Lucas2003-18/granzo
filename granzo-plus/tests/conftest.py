import pytest

from app import db
from app.services.store import Store

KEY = "k" * 40


@pytest.fixture
def store():
    return Store(db.connect(":memory:", KEY))
