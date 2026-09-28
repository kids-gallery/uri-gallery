"""llm-server — M6(Qwen3-4B-Instruct-2507, Ollama `qwen3:4b-instruct-2507-q4_K_M`) 내부 동기 HTTP 서버(research R-18, llm-contract).

127.0.0.1:8200 전용. 큐 워커가 아니다. DB에 쓰지 않는다(기록은 호출자 app-api).
  POST /v1/caption   허용 입력 → 설명 초안(규칙 검사·재생성 2회·템플릿 낮춤)
  GET  /v1/ready     {ollama, activeVersion, licenseConfirmed, model{state…}, queue{…}}
  POST /v1/warmup    모델을 미리 올린다(운영 화면 "지금 불러오기") — 202, 기다리지 않는다

모델 적재 시간: 공유 Ollama는 keep_alive 5분 뒤 모델을 내린다(§7.3, 5m 초과 금지).
그래서 다음 요청은 적재 시간(실측 2.9초, 공유 서버가 붐비면 10~30초)을 다시 기다린다.
/v1/ready가 cold·loading·ready와 남은 시간 짐작을 알려 주고, 화면이 그걸로 안내한다.
"""
from __future__ import annotations

import asyncio
import os
import threading
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from common.config import load_manifest
from common.logging import get_logger

from . import caption as cap
from . import ollama_client as oc

app = FastAPI(title="uam llm-server", docs_url=None, redoc_url=None, openapi_url=None)
log = get_logger(worker="llm-server")
_sem = asyncio.Semaphore(1)          # Ollama 동시 호출 1건(§8.1-5)
_waiting = 0


class ModelState:
    """cold(내려가 있음) · loading(올리는 중) · ready(올라가 있음) · unavailable(Ollama 없음·태그 없음) · disabled(라이선스·다이제스트)"""

    def __init__(self):
        self.lock = threading.Lock()
        self.loading_since: float | None = None
        self.last_load_s: float | None = None
        self.checked_at = 0.0
        self.cache: dict = {}
        m6 = (load_manifest().get("models") or {}).get("M6") or {}
        self.manifest = m6
        self.expected_s = (m6.get("load") or {}).get("expected_seconds")

    def version_label(self, digest: str | None) -> str | None:
        return f"qwen3-4b-instruct-2507-q4_K_M@sha256:{digest[:12]}" if digest else None

    def check(self, force: bool = False) -> dict:
        """Ollama 조회는 5초 캐시(화면 폴링이 공유 서버를 두드리지 않게)."""
        now = time.time()
        if not force and now - self.checked_at < 5 and self.cache:
            return self._with_loading(self.cache)
        model = oc.CHAT_MODEL
        up = oc.version() is not None
        d: dict = {"ollama": up, "model": model, "digest": None, "present": False, "loaded": False, "expiresAt": None}
        if up:
            try:
                d["present"] = any(t.get("name") == model for t in oc.tags())
                if d["present"]:
                    d["digest"] = oc.blob_digest(model)
                ps = [p for p in oc.loaded() if p.get("name") == model]
                if ps:
                    d["loaded"], d["expiresAt"] = True, ps[0].get("expires_at")
            except oc.OllamaError:
                d["ollama"] = False
        want = self.manifest.get("weights_sha256")
        d["digestMatches"] = bool(d["digest"]) and (want is None or want == d["digest"])
        d["licenseConfirmed"] = bool(self.manifest.get("license_confirmed"))
        self.cache, self.checked_at = d, now
        return self._with_loading(d)

    def _with_loading(self, d: dict) -> dict:
        d = dict(d)
        if not d["ollama"] or not d["present"]:
            state = "unavailable"
        elif not d["digestMatches"] or not d["licenseConfirmed"]:
            state = "disabled"
        elif self.loading_since is not None:
            state = "loading"
        elif d["loaded"]:
            state = "ready"
        else:
            state = "cold"
        d["state"] = state
        d["expectedLoadSeconds"] = self.expected_s
        d["lastLoadSeconds"] = self.last_load_s
        d["elapsedSeconds"] = d["remainingSeconds"] = None
        if state == "loading":
            el = time.time() - self.loading_since
            d["elapsedSeconds"] = round(el, 1)
            exp = self.expected_s or self.last_load_s
            if exp:
                d["remainingSeconds"] = round(max(0.0, exp - el), 1)
        return d

    def begin_load(self) -> None:
        with self.lock:
            if self.loading_since is None:
                self.loading_since = time.time()

    def end_load(self, took: float | None) -> None:
        with self.lock:
            self.loading_since = None
            if took is not None and took > 0.05:
                self.last_load_s = round(took, 2)
        self.checked_at = 0.0        # 다음 조회는 새로


state = ModelState()


def _ready_body() -> dict:
    d = state.check()
    return {"ollama": d["ollama"], "activeVersion": state.version_label(d["digest"]) if d["digestMatches"] else None,
            "licenseConfirmed": d["licenseConfirmed"],
            "model": {k: d[k] for k in ("model", "state", "loaded", "expiresAt", "expectedLoadSeconds",
                                        "lastLoadSeconds", "elapsedSeconds", "remainingSeconds")},
            "queue": {"inFlight": _sem.locked(), "waiting": _waiting}}


@app.get("/v1/ready")
def ready():
    return _ready_body()


def _warm_blocking() -> None:
    state.begin_load()
    took = None
    try:
        took = oc.warm(num_ctx=cap.GEN_OPTIONS["num_ctx"])
        log.info("model_load", model_id="M6", load_state="ready", load_ms=int(took * 1000))
    except oc.OllamaError as e:
        log.warning("model_load", model_id="M6", load_state="failed", diagnostic=e.kind)
    finally:
        state.end_load(took)


@app.post("/v1/warmup", status_code=202)
async def warmup():
    d = await asyncio.to_thread(state.check, True)
    if d["state"] in ("cold",):
        threading.Thread(target=_warm_blocking, daemon=True).start()
        await asyncio.sleep(0)
    return await asyncio.to_thread(_ready_body)


def _generate(inp: dict, call) -> dict:
    """규칙 검사 재생성 최대 2회(총 3회). 모두 걸리면 템플릿(llm_to_template). 걸린 문장은 돌려주지 않는다(BR-CAP-07)."""
    fails, last_fail, n = 0, None, 0
    msgs = cap.build_messages(inp)
    for n in range(1, cap.MAX_REGEN + 2):
        out = oc.chat(msgs, options=cap.GEN_OPTIONS, call=call)
        if out["load_s"] > 0.5:
            state.end_load(out["load_s"])
        fc = cap.rule_check(out["content"], inp)
        if fc is None:
            return {"source": "llm", "body": out["content"], "generationCount": n, "ruleCheck": "pass",
                    "ruleFailCount": fails, "lastFailClass": last_fail}
        fails, last_fail = fails + 1, fc
    return {"source": "template", "body": cap.template(inp), "generationCount": n, "ruleCheck": "fail",
            "ruleFailCount": fails, "lastFailClass": last_fail}


@app.post("/v1/caption")
async def caption(request: Request):
    global _waiting
    t0 = time.monotonic()
    body = await request.json()
    inp = cap.allowed_input(body)
    if not inp.get("keywords") and not inp.get("tags"):
        return JSONResponse({"outcome": "invalid_input", "code": "keywords_required"}, status_code=422)
    d = await asyncio.to_thread(state.check)
    if d["state"] in ("unavailable",):
        return {"outcome": "engine_down" if not d["ollama"] else "model_not_ready", "model": state._with_loading(d)}
    if d["state"] == "disabled":
        return {"outcome": "model_not_ready", "model": state._with_loading(d)}
    _waiting += 1
    try:
        await _sem.acquire()
    finally:
        _waiting -= 1
    try:
        if (await asyncio.to_thread(state.check))["state"] == "cold":
            state.begin_load()        # 첫 요청이 적재를 겪는다 — 화면은 /v1/ready로 "불러오는 중"을 본다
        call = oc._Call()
        task = asyncio.create_task(asyncio.to_thread(_generate, inp, call))
        while not task.done():
            await asyncio.wait({task}, timeout=0.5)
            if not task.done() and await request.is_disconnected():
                call.cancel()         # 호출자가 끊으면 Ollama 연결을 닫아 생성을 멈춘다
        try:
            res = task.result()
        except oc.OllamaError as e:
            kind = {"model_not_ready": "model_not_ready", "timeout": "timeout", "cancelled": "cancelled"}.get(e.kind, "engine_down")
            log.warning("caption", model_id="M6", outcome=kind, duration_ms=int((time.monotonic() - t0) * 1000))
            return {"outcome": kind}
    finally:
        if state.loading_since is not None:
            state.end_load(None)
        _sem.release()
    log.info("caption", model_id="M6", outcome="ok", duration_ms=int((time.monotonic() - t0) * 1000))
    return {"outcome": "ok", **res,
            "model": {"id": "M6", "version": state.version_label(state.cache.get("digest"))}}


@app.on_event("startup")
def _startup() -> None:
    d = state.check(force=True)
    log.info("startup", serving_group="llm", load_state=d["state"], port=8200)
    # 기동 때 한 번 올려 둔다(R-22: 설명 30초 상한). keep_alive는 5m 규칙대로 — 그 뒤 첫 요청은 다시 적재한다
    if os.environ.get("LLM_WARM_ON_START", "1") == "1" and d["state"] == "cold":
        threading.Thread(target=_warm_blocking, daemon=True).start()
