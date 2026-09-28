"""외부 키 인증·한도·호출 기록(T121, BR-API-03·04, D17, research R-09, G2·G24·G25).

- `X-API-Key` 원문은 저장·로그하지 않는다. SHA-256으로 `api_key.key_hash`와 대조한다.
- 한도는 별도 카운터 없이 `external_call_log`(ix_ecl_key_time) 창 집계와 진행 중 `external_job` 수로 판정한다.
- 모든 호출(거절 포함)을 `external_call_log`에 남긴다 — 입력·키 원문 없음. 막힌 게이트는 `gate_event`(분류 코드만).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from common.config import load_yaml

STATUS_OK = {200, 202, 401, 403, 404, 413, 422, 429, 503, 504}   # SD_03 chk_ecl_status
FUNCS = ("segment", "classify", "pose", "relief", "caption")


@dataclass
class Key:
    key_id: int
    kind: str


@dataclass
class ApiError(Exception):
    status: int
    code: str
    reason: str | None = None
    gate: str | None = None
    headers: dict = field(default_factory=dict)

    def body(self) -> dict:
        b = {"type": f"about:blank#{self.code}", "title": self.code, "status": self.status, "code": self.code}
        if self.reason:
            b["reason"] = self.reason
        if self.gate:
            b["gate"] = self.gate
        return b


def limits() -> dict:
    return load_yaml("ext-limits")


def authenticate(cur, raw: str | None) -> Key:
    if not raw:
        raise ApiError(401, "unauthorized", "key_missing", "G2")
    cur.execute("SELECT key_id, key_kind, status FROM api_key WHERE key_hash = %s",
                (hashlib.sha256(raw.encode()).hexdigest(),))
    row = cur.fetchone()
    if not row or row["status"] != "active":
        raise ApiError(401, "unauthorized", "key_invalid" if not row else "key_revoked", "G2")
    return Key(row["key_id"], row["key_kind"])


def check_rate(cur, key: Key, creates_job: bool) -> None:
    lim = limits()
    cur.execute("""SELECT SUM(called_at >= UTC_TIMESTAMP() - INTERVAL 1 MINUTE) m, COUNT(*) d FROM external_call_log
                    WHERE key_id = %s AND called_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY
                      AND endpoint IN ('segment','classify','pose','relief','caption')""", (key.key_id,))
    r = cur.fetchone()
    if int(r["m"] or 0) >= lim["per_minute"]:
        raise ApiError(429, "rate_limited", "per_minute", "G2", {"Retry-After": "60"})
    if int(r["d"] or 0) >= lim["per_day"]:
        raise ApiError(429, "rate_limited", "per_day", "G2", {"Retry-After": "3600"})
    if creates_job:
        cur.execute("SELECT COUNT(*) n FROM external_job WHERE key_id = %s AND status IN ('queued','running')", (key.key_id,))
        if int(cur.fetchone()["n"]) >= lim["concurrent"]:
            raise ApiError(429, "rate_limited", "concurrent", "G2", {"Retry-After": "10"})


def record(cur, key_id: int | None, endpoint: str, status: int, gate: str | None = None, reason: str | None = None) -> None:
    """호출 기록 + 막힌 게이트. 자체 실패는 응답을 바꾸지 않는다(호출자가 삼킨다)."""
    cur.execute("INSERT INTO external_call_log (key_id, endpoint, http_status) VALUES (%s, %s, %s)",
                (key_id, endpoint if endpoint in FUNCS + ("jobs", "result") else "other", status if status in STATUS_OK else 503))
    if gate:
        role = "operator" if gate == "G25" else "external_client"
        cur.execute("""INSERT INTO gate_event (gate_id, subject_kind, subject_id, actor_role, reason_code)
                       VALUES (%s, 'external_call', NULL, %s, %s)""", (gate, role, (reason or "blocked")[:40]))
