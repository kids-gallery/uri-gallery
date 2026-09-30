"""test_app.py — 배포 전 3분 (1팀 우리 아이 미술관). 실행: .venv/bin/python -m pytest -q test_app.py  (서버는 꺼 둔다)

  test_health                  → 모델을 올리고 뜬 서버
  test_predict_normal          → 응답 필드가 계약과 정확히 같은가(점수 없음)
  test_predict_unknown_field   → 모르는 칸(아이 이름 같은 개인정보)은 422 — 조용히 무시하지 않는다
  test_predict_boundary        → 짧은 변 63px 은 422, 64px 은 200 · 그림 없는 빈 종이는 값 대신 판단보류(200)
  test_batch_count_and_order   → 개수와 순서, 라벨까지(사람 → 집 → 동물)
"""
import base64
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app import app

EX = Path(__file__).with_name("examples")
REQ = json.loads((EX / "request.json").read_text(encoding="utf-8"))
img = lambda name: {"image_base64": base64.b64encode((EX / "images" / f"{name}.png").read_bytes()).decode()}


def test_health():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200 and r.json()["status"] == "ok"


def test_predict_normal():
    with TestClient(app) as c:
        r = c.post("/predict", json=REQ)
        assert r.status_code == 200
        d = r.json()
        assert set(d) == {"label", "warnings", "model_version"}
        assert d["label"] == "사람 그림" and d["warnings"] == []


def test_predict_unknown_field():
    with TestClient(app) as c:
        assert c.post("/predict", json={**REQ, "child_name": "하늘"}).status_code == 422
        assert c.post("/predict", json={"image_base64x": REQ["image_base64"]}).status_code == 422


def test_predict_boundary():
    with TestClient(app) as c:
        assert c.post("/predict", json=img("tiny63")).status_code == 422
        r = c.post("/predict", json=img("edge64"))
        assert r.status_code == 200
        r = c.post("/predict", json=img("blank"))
        assert r.status_code == 200 and r.json()["label"] == "판단보류"


def test_batch_count_and_order():
    with TestClient(app) as c:
        r = c.post("/predict/batch", json=json.loads((EX / "request_batch.json").read_text(encoding="utf-8")))
        assert r.status_code == 200
        d = r.json()
        assert d["count"] == 3
        assert [x["label"] for x in d["results"]] == ["사람 그림", "집 그림", "동물 그림"]
