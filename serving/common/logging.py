"""허용 목록 로거(BR-PRV-01, stage-job §10).

JSON 한 줄에 아래 필드만 남긴다. 객체 키·파일 경로·별칭·제목·한마디·키워드·예외 원문은 버린다.
"""
from __future__ import annotations

import logging
import sys
import re

import structlog

ALLOWED = frozenset({
    "ts", "level", "event", "worker", "job_id", "stage_kind", "model_id", "version_label",
    "attempt_count", "status", "error_class", "downgrade_cause", "duration_ms",
    # 적재 상태·준비 확인(모델 적재 시간 화면용). 경로 없음
    "load_state", "load_ms", "serving_group", "diagnostic", "outcome", "port",
    # 설명 규칙 파일 버전(research R-26) — 규칙 교체 전후 구분용. 문장·입력 없음
    "rules_version",
})


EVENTS = {"model_load", "job_end", "ext_job_end", "check_end", "eval_end", "eval_db_error", "db_unavailable", "caption", "startup"}
CATEGORIES = {
    "level": {"info", "warning", "warn", "error", "critical", "debug"},
    "stage_kind": {"split", "judge", "animate_render", "depth_relief", "frame_compose", "caption", "sculpture"},
    "status": {"queued", "running", "done", "done_downgraded", "retry_wait", "failed", "cancelled", "passed", "ok"},
    "error_class": {"engine_down", "timeout", "storage", "db", "model_not_ready"},
    "downgrade_cause": {"animated_to_relief", "relief_to_frame", "sculpture_to_relief", "split_fail", "animated_to_frame", "llm_to_template"},
    "load_state": {"disabled", "not_loaded", "loading", "ready", "failed", "cold"},
    "serving_group": {"cpu_vision", "gpu", "llm"},
    "outcome": {"ok", "engine_down", "timeout", "storage", "db", "model_not_ready", "quality_below", "cancelled", "unknown"},
    "diagnostic": {"load_timeout", "fake_injected", "model_not_ready", "engine_down", "timeout"},
}
def _allowlist(_, __, event_dict: dict) -> dict:
    out = {}
    for k, v in event_dict.items():
        if k == "event":
            out[k] = v if isinstance(v, str) and v in EVENTS else "unknown"
        elif k in CATEGORIES and isinstance(v, str) and v in CATEGORIES[k]:
            out[k] = v
        elif k in {"job_id", "attempt_count", "duration_ms", "load_ms", "port"} and type(v) in {int, float} and 0 <= v < 2**53:
            out[k] = v
        elif k == "ts" and isinstance(v, str) and re.fullmatch(r"[0-9T:.+Z-]{20,40}", v):
            out[k] = v
        elif k == "model_id" and isinstance(v, str) and re.fullmatch(r"M[1-7]", v):
            out[k] = v
        elif k == "worker" and isinstance(v, str) and v.split("@", 1)[0] in {"cpu_vision", "gpu", "llm"}:
            out[k] = v.split("@", 1)[0]
        elif k == "version_label" and isinstance(v, str) and re.fullmatch(r"(?:dev-[a-f0-9]{32}|v?[0-9]+(?:\.[0-9]+){1,3})", v):
            out[k] = v
    return out


_configured = False


def get_logger(**bind):
    global _configured
    if not _configured:
        logging.basicConfig(format="%(message)s", stream=sys.stdout, level=logging.INFO)
        structlog.configure(
            processors=[
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso", utc=True, key="ts"),
                _allowlist,
                structlog.processors.JSONRenderer(ensure_ascii=False),
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=True,
        )
        _configured = True
    return structlog.get_logger().bind(**bind)
