import pytest
from common.config import validate_production
@pytest.mark.parametrize("fake", ["1", "M3,M7", "true"])
def test_reject_demo(monkeypatch, fake):
    monkeypatch.setenv("UAM_ENV", "production")
    monkeypatch.setenv("UAM_FAKE_MODELS", fake)
    with pytest.raises(ValueError): validate_production()
def test_explicit_real(monkeypatch):
    monkeypatch.setenv("UAM_ENV", "production")
    monkeypatch.setenv("UAM_FAKE_MODELS", "0")
    monkeypatch.setenv("DEV_ACTIVATE_MODELS", "0")
    monkeypatch.delenv("DB_PASSWORD_FILE", raising=False)
    monkeypatch.setenv("DB_PASSWORD", "x"*32)
    validate_production()
