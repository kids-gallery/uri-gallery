"""컨테이너에서도 로컬 기본값과 파일 비밀 값 계약을 지킨다."""
import pytest
from common.config import load_settings
from model_api.main import main


def test_environment_fallback(monkeypatch):
    monkeypatch.delenv("DB_PASSWORD_FILE", raising=False)
    monkeypatch.setenv("DB_PASSWORD", "fixture-env")
    assert load_settings().db_password == "fixture-env"


@pytest.mark.parametrize("suffix", ["", "\n", "\r\n"])
def test_file_precedes_environment(tmp_path, monkeypatch, suffix):
    path = tmp_path / "fixture"
    path.write_bytes((" fixture-file " + suffix).encode())
    monkeypatch.setenv("DB_PASSWORD_FILE", str(path))
    monkeypatch.setenv("DB_PASSWORD", "fixture-env")
    assert load_settings().db_password == " fixture-file "


def test_missing_file_fails_closed(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PASSWORD_FILE", str(tmp_path / "missing"))
    monkeypatch.setenv("DB_PASSWORD", "fixture-env")
    with pytest.raises(FileNotFoundError):
        load_settings()


@pytest.mark.parametrize("host, expected", [(None, "127.0.0.1"), ("0.0.0.0", "0.0.0.0")])
def test_listening_address(monkeypatch, host, expected):
    if host is None:
        monkeypatch.delenv("MODEL_API_HOST", raising=False)
    else:
        monkeypatch.setenv("MODEL_API_HOST", host)
    calls = []
    monkeypatch.setattr("model_api.main.uvicorn.run", lambda *a, **kw: calls.append(kw))
    main()
    assert calls[0]["host"] == expected


def test_missing_secret_stops_model_api_process(tmp_path):
    import os
    import subprocess
    import sys
    env = dict(os.environ, DB_PASSWORD_FILE=str(tmp_path / "missing-secret"))
    result = subprocess.run(
        [sys.executable, "-m", "model_api.main"], env=env,
        capture_output=True, text=True, timeout=10,
    )
    assert result.returncode != 0
    assert "FileNotFoundError" in result.stderr
