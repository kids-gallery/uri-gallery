"""metrics.py — 운영에서 보는 다섯 숫자 (MS6 · 완성본).

이 서버가 사는 동안의 값이다. 껐다 켜면 0 — 실무에서는 별도 저장소에 쌓는다.
  observe()        미들웨어에서 요청마다 — 요청 수 · 오류 · 지연
  observe_label()  추론 결과를 아는 곳(/predict)에서 — 라벨만. 요청 수는 세지 않는다
  snapshot()       /metrics 가 돌려주는 «지금 이 순간»의 다섯 숫자
여럿이 같은 변수를 고치므로 Lock 으로 감싼다 — 고치는 곳과 읽는 곳 둘 다.
"""
import threading
from collections import Counter

_lock = threading.Lock()
_state = {"requests": 0, "errors": 0, "latencies": [], "labels": Counter()}
_MAX_KEEP = 1000        # 지연은 최근 1000건만 (메모리 보호)


def observe(status: int, dur_ms: float):
    """미들웨어에서 요청마다 부른다."""
    with _lock:                                   # 한 번에 한 요청만
        _state["requests"] += 1
        if status >= 500:
            _state["errors"] += 1
        _state["latencies"].append(dur_ms)
        if len(_state["latencies"]) > _MAX_KEEP:
            del _state["latencies"][0]


def observe_label(label: str):
    """추론 결과를 아는 곳에서 부른다. 요청 수는 세지 않는다 (2교시에 찾아낸 «두 배» 결함의 해법)."""
    with _lock:
        _state["labels"][label] += 1


def snapshot() -> dict:
    with _lock:
        n = _state["requests"]
        lat = sorted(_state["latencies"])
        total = sum(_state["labels"].values())
        return {
            "requests_total": n,
            "error_rate": round(_state["errors"] / n, 4) if n else 0.0,
            "latency_p95_ms": round(lat[int(len(lat) * 0.95) - 1], 1) if lat else 0.0,   # MS3 과 같은 «정렬해서 95번째»
            "abstain_rate": round(_state["labels"]["판단보류"] / total, 4) if total else 0.0,
            "label_distribution": dict(_state["labels"]),
        }
