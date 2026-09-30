"""bench.py — 측정 함수 모음 (MS3 의 bench.py 와 같은 자). 팀에 맞춰 바뀐 것은 «요청 본문을 어디서 읽나» 하나뿐이다.

  measure()            단건 100회 → p50 · p95 · 처리량
  measure_batch()      배치 크기별 → 건당 ms · 처리량
  measure_concurrent() 동시 수별  → p50 · p95 · 처리량 · 오류

요청 본문은 examples/request.json 을 쓴다 — 같은 입력으로 재야 전후를 비교할 수 있다.
"""
import json
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

BASE = "http://127.0.0.1:8000"
PAYLOAD = json.loads(Path(__file__).with_name("examples").joinpath("request.json").read_text(encoding="utf-8"))


def warmup(n=5):
    for _ in range(n):
        requests.post(f"{BASE}/predict", json=PAYLOAD, timeout=60)


def measure(n=100, payload=PAYLOAD):
    times, errors = [], 0
    for _ in range(n):
        t0 = time.perf_counter()
        r = requests.post(f"{BASE}/predict", json=payload, timeout=60)
        times.append((time.perf_counter() - t0) * 1000)
        if r.status_code != 200:
            errors += 1
    times.sort()
    return {"n": n, "p50_ms": round(statistics.median(times), 1),
            "p95_ms": round(times[int(n * 0.95) - 1], 1), "max_ms": round(times[-1], 1),
            "mean_ms": round(statistics.mean(times), 1),
            "throughput_rps": round(n / (sum(times) / 1000), 2), "errors": errors}


def measure_batch(size, total=64, payload=PAYLOAD):
    items = [payload] * size
    reps = total // size
    t0 = time.perf_counter()
    for _ in range(reps):
        r = requests.post(f"{BASE}/predict/batch", json={"items": items}, timeout=120)
        assert r.status_code == 200, r.text
    elapsed = time.perf_counter() - t0
    return {"batch": size, "총시간_s": round(elapsed, 2),
            "건당_ms": round(elapsed * 1000 / total, 1), "처리량_rps": round(total / elapsed, 1)}


def measure_concurrent(workers, total=40, payload=PAYLOAD):
    def one(_):
        t0 = time.perf_counter()
        r = requests.post(f"{BASE}/predict", json=payload, timeout=120)
        return (time.perf_counter() - t0) * 1000, r.status_code

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(one, range(total)))
    elapsed = time.perf_counter() - t0
    times = sorted(r[0] for r in results)
    return {"동시": workers, "p50_ms": round(times[len(times) // 2], 1),
            "p95_ms": round(times[int(len(times) * 0.95) - 1], 1),
            "처리량_rps": round(total / elapsed, 1), "오류": sum(1 for r in results if r[1] != 200)}


if __name__ == "__main__":
    warmup()
    print("단건 100회 :", measure())
    for b in (1, 4, 8):
        print("배치", b, ":", measure_batch(b))
    for w in (1, 5):
        print("동시", w, ":", measure_concurrent(w))
