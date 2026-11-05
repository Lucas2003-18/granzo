import pytest

from app import config, db


def test_wrong_key_cannot_open(tmp_path):
    p = str(tmp_path / "a.db")
    c = db.connect(p, "a" * 40)
    db.init(c)
    c.close()
    with pytest.raises(Exception):
        db.connect(p, "b" * 40)


def test_file_is_not_plain_sqlite(tmp_path):
    p = tmp_path / "a.db"
    c = db.connect(str(p), "a" * 40)
    db.init(c)
    c.commit(); c.close()
    assert not p.read_bytes().startswith(b"SQLite format 3")


def test_key_with_quote_rejected():
    with pytest.raises(ValueError):
        db.connect(":memory:", "x'; DROP TABLE a;--" + "x" * 30)


def test_config_requires_secrets():
    with pytest.raises(config.ConfigError):
        config.load({})


def test_short_db_key_rejected():
    with pytest.raises(config.ConfigError):
        config.read_db_key({"DB_KEY": "curta"})
