"""공유 Ollama 서버 클라이언트 — `docs/OLLAMA 설정 참조.md` §8.2 템플릿을 따른다(표준 라이브러리만).

지키는 규칙(§7.3·§8.4):
- URL·모델 이름은 환경 변수(OLLAMA_URL, OLLAMA_CHAT_MODEL)
- 타임아웃 300초(앞 사람 요청을 기다리는 시간 포함), 연결 실패·시간 초과만 3초·6초 뒤 재시도, HTTP 오류는 재시도 안 함
- keep_alive "5m"(영구 상주 -1 금지), num_ctx ≤ 8192
- 동시 호출 1건 — 호출자(llm_server.app)가 세마포어로 막는다
- qwen3 계열은 think:false + 프롬프트 끝 `/no_think`, 남은 <think> 블록은 지운다
- 모델 태그는 `qwen3:4b-instruct-2507-q4_K_M`(생각 모드 없는 Qwen3-4B). 공유 서버의 `qwen3:4b`는
  Qwen3-4B-Thinking-2507과 같은 블롭(sha256:3e4cb141…)이라 think:false·/no_think·빈 <think> 미리 채우기로도
  생각 과정이 본문에 섞인다(2026-09-28 실측) — 쓰지 않는다
- 런타임 코드에는 pull·create·rm·stop·serve 호출이 없다(모델 준비는 배포 전 1회 수동, ops/models.py 안내)
"""
from __future__ import annotations

import http.client
import json
import os
import re
import socket
import threading
import time
import urllib.parse

# localhost 금지: IPv6 ::1은 공유 서버의 다른(설정만 있고 트래픽 없는) 인스턴스로 간다(참조 문서 §4 P7)
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
CHAT_MODEL = os.environ.get("OLLAMA_CHAT_MODEL", "qwen3:4b-instruct-2507-q4_K_M")
TIMEOUT = 300
KEEP_ALIVE = "5m"
MAX_NUM_CTX = 8192
_sleep = time.sleep          # 시험에서 바꿔 끼운다
_THINK = re.compile(r"<think>.*?</think>\s*", re.S)


class OllamaError(Exception):
    """kind: engine_down(연결 실패·5xx·재시도 소진) · timeout · model_not_ready(404) · bad_request(400) · cancelled"""

    def __init__(self, kind: str, status: int | None = None):
        super().__init__(kind)
        self.kind = kind
        self.status = status


class _Call:
    """취소할 수 있는 한 번의 HTTP 호출 — 연결을 닫으면 Ollama가 생성을 멈춘다(llm-contract §11 취소)."""

    def __init__(self):
        self.conn: http.client.HTTPConnection | None = None
        self.cancelled = threading.Event()

    def cancel(self) -> None:
        self.cancelled.set()
        c = self.conn
        if c is not None:
            try:
                c.sock and c.sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            c.close()


def _once(method: str, path: str, payload: dict | None, call: _Call | None, timeout: float) -> dict:
    u = urllib.parse.urlparse(OLLAMA_URL)
    conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=timeout)
    if call is not None:
        call.conn = conn
    try:
        body = json.dumps(payload).encode() if payload is not None else None
        conn.request(method, (u.path.rstrip("/") + path), body=body, headers={"Content-Type": "application/json"})
        r = conn.getresponse()
        data = r.read()
        if r.status >= 400:
            raise OllamaError("model_not_ready" if r.status == 404 else "bad_request" if r.status == 400 else "http_5xx",
                              r.status)
        return json.loads(data or b"{}")
    finally:
        conn.close()


def _request(method: str, path: str, payload: dict | None = None, retries: int = 3,
             call: _Call | None = None, timeout: float = TIMEOUT) -> dict:
    for attempt in range(retries):
        if call is not None and call.cancelled.is_set():
            raise OllamaError("cancelled")
        try:
            return _once(method, path, payload, call, timeout)
        except OllamaError as e:
            if e.kind != "http_5xx":
                raise                              # 4xx: 재시도해도 같은 결과
            last = OllamaError("engine_down", e.status)
        except (socket.timeout, TimeoutError):
            last = OllamaError("timeout")
        except (ConnectionError, OSError, http.client.HTTPException):
            if call is not None and call.cancelled.is_set():
                raise OllamaError("cancelled")
            last = OllamaError("engine_down")
        if attempt == retries - 1:
            raise last
        time.sleep(2 ** attempt * 3)               # 3초, 6초
    raise OllamaError("engine_down")


def chat(messages: list[dict], model: str = CHAT_MODEL, options: dict | None = None,
         call: _Call | None = None, json_mode: bool = False) -> dict:
    """{content, load_s, total_s} — load_s는 Ollama가 알려 준 적재 시간(이미 올라가 있었으면 0에 가깝다)."""
    opts = {"num_ctx": 4096, **(options or {})}
    opts["num_ctx"] = min(int(opts["num_ctx"]), MAX_NUM_CTX)
    msgs = [dict(m) for m in messages]
    if model.startswith("qwen3") and msgs and msgs[-1]["role"] == "user" and not msgs[-1]["content"].rstrip().endswith("/no_think"):
        msgs[-1]["content"] = msgs[-1]["content"].rstrip() + " /no_think"
    body = {"model": model, "messages": msgs, "stream": False, "think": False,
            "keep_alive": KEEP_ALIVE, "options": opts}
    if json_mode:
        body["format"] = "json"
    out = _request("POST", "/api/chat", body, call=call)
    return {"content": _THINK.sub("", out.get("message", {}).get("content", "")).strip(),
            "load_s": (out.get("load_duration") or 0) / 1e9, "total_s": (out.get("total_duration") or 0) / 1e9}


# ── 적재 상태(화면에 적재 시간을 보여 주기 위한 읽기 전용 조회) ─────────────────
def version() -> str | None:
    try:
        return _request("GET", "/api/version", retries=1, timeout=3).get("version")
    except OllamaError:
        return None


def tags() -> list[dict]:
    return _request("GET", "/api/tags", retries=1, timeout=5).get("models", [])


def loaded() -> list[dict]:
    """/api/ps — 지금 메모리에 올라가 있는 모델과 내려갈 시각(expires_at)."""
    return _request("GET", "/api/ps", retries=1, timeout=5).get("models", [])


def blob_digest(model: str = CHAT_MODEL) -> str | None:
    """`ollama show --modelfile`의 FROM 블롭 다이제스트(R-22 weights_sha256). 경로는 밖으로 내보내지 않는다."""
    info = _request("POST", "/api/show", {"model": model}, retries=1, timeout=10)
    m = re.search(r"^FROM\s+\S*sha256-([0-9a-f]{64})", info.get("modelfile", ""), re.M)
    return m.group(1) if m else None


def warm(model: str = CHAT_MODEL, num_ctx: int = 4096) -> float:
    """모델을 메모리에 올린다(프롬프트 없는 generate = 적재만). 걸린 초를 돌려준다. keep_alive 5m 규칙 그대로.

    num_ctx는 실제 호출과 같아야 한다 — 다르면 Ollama가 첫 실제 호출에서 모델을 다시 올린다(2026-09-28 실측 2.9초 재적재).
    """
    t = time.monotonic()
    _request("POST", "/api/generate", {"model": model, "keep_alive": KEEP_ALIVE, "stream": False,
                                       "options": {"num_ctx": min(num_ctx, MAX_NUM_CTX)}})
    return time.monotonic() - t
