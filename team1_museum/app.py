"""app.py — 팀 모델 공용 서버 (MS 과정 6일 최종본 app.py 와 같은 뼈대).

네 팀이 같은 app.py 를 쓴다. 팀마다 다른 것은 세 파일뿐이다:
  predict.py   _load() 한 번 · predict(payload: dict) -> dict      (팀 모델을 부르는 유일한 곳)
  schemas.py   PredictRequest · PredictResponse · Batch · Health     (무엇을 받고 무엇을 돌려주는지)
  settings.py  모델 이름·버전·정책값                                  (.env 로 바꾼다 · 코드는 안 고친다)

이 파일에 팀 이름·필드 이름이 하나도 없는 것이 핵심이다 — 계약은 schemas.py 가, 계산은 predict.py 가 안다.

  MS1  predict 를 HTTP 로 연다        POST /predict
  MS2  계약                          schemas.py 의 response_model · 422
  MS3  lifespan(기동 시 한 번 적재)   첫 요청이 느리지 않게
  MS4  실패 설계                     ValueError → 422(입력 문제) · 그 밖 → 500(서버 문제) · 판단보류는 검토 큐
  MS5  설정 분리                     settings · .env
  MS6  다섯 숫자                     GET /metrics
"""
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request

import metrics
from schemas import (BatchRequest, BatchResponse, HealthResponse,
                     PredictRequest, PredictResponse)
from settings import settings

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ms")

REVIEW_QUEUE = Path("review_queue.jsonl")
STATE = {"ready": False, "loaded_at": None, "load_seconds": None}
_prefix = os.environ.get("JUPYTERHUB_SERVICE_PREFIX", "").rstrip("/")   # JupyterHub 프록시 뒤에서 /docs 가 열리게


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.perf_counter()
    import predict as predict_module
    app.state.predict = predict_module.predict
    predict_module.warmup()                                   # 모델을 한 번 읽어 둔다 (MS3)
    STATE["load_seconds"] = round(time.perf_counter() - t0, 2)
    STATE["loaded_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    STATE["ready"] = True
    logger.info("[lifespan] 모델 적재 완료 %.2f초 (%s %s)",
                STATE["load_seconds"], settings.model_name, settings.model_version)
    yield
    logger.info("[lifespan] 종료")


app = FastAPI(title=f"{settings.model_name} API", lifespan=lifespan,
              description=settings.model_description,
              root_path=f"{_prefix}/proxy/{settings.port}" if _prefix else "")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    req_id = uuid.uuid4().hex[:8]
    request.state.req_id = req_id
    t0 = time.perf_counter()
    response = await call_next(request)
    dur_ms = (time.perf_counter() - t0) * 1000
    metrics.observe(response.status_code, dur_ms)
    logger.info("req_id=%s path=%s status=%s dur_ms=%.1f",
                req_id, request.url.path, response.status_code, dur_ms)
    response.headers["X-Request-ID"] = req_id
    return response


def _require_ready():
    if not STATE["ready"]:
        raise HTTPException(status_code=503, detail="모델을 준비 중입니다. 잠시 후 다시 시도하세요")


def _append(path: Path, rec: dict):
    rec["at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _run(request: Request, payload: dict) -> dict:
    """predict 를 한 번 부른다. 입력 문제(ValueError)는 422, 그 밖의 예외는 500 — 둘을 섞지 않는다 (MS4)."""
    try:
        return app.state.predict(payload)
    except ValueError as e:                                   # 모델이 «이 입력은 못 받는다»고 말한 것
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("추론 실패 req_id=%s", request.state.req_id)
        raise HTTPException(status_code=500, detail="서버에서 판단에 실패했습니다")


@app.get("/health", response_model=HealthResponse, summary="서비스가 판단할 준비가 되었는지 알려준다")
def health():
    return {"status": "ok" if STATE["ready"] else "loading",
            "model_name": settings.model_name, "model_version": settings.model_version,
            "load_seconds": STATE["load_seconds"]}


@app.post("/predict", response_model=PredictResponse, summary="한 건을 판단한다")
def api_predict(req: PredictRequest, request: Request):
    _require_ready()
    out = _run(request, req.model_dump())
    logger.info("req_id=%s label=%s model=%s", request.state.req_id, out["label"], out["model_version"])
    metrics.observe_label(out["label"])
    if out["label"] == "판단보류":                             # 사람이 볼 큐 (원문은 넣지 않는다)
        _append(REVIEW_QUEUE, {"req_id": request.state.req_id, "warnings": out.get("warnings", [])})
    return out


@app.post("/predict/batch", response_model=BatchResponse, summary="여러 건을 한 번에 판단한다")
def api_predict_batch(req: BatchRequest, request: Request):
    _require_ready()
    results = [_run(request, item.model_dump()) for item in req.items]
    for out in results:
        metrics.observe_label(out["label"])
    return {"results": results, "count": len(results)}


@app.get("/metrics", summary="운영에서 보는 다섯 숫자")
def get_metrics():
    return metrics.snapshot()
