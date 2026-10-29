"""디자인 진단(design_audit.py)이 시험 계정과 작품을 만들 때 쓰는 API 도우미. 표준 라이브러리만 쓴다.

BASE(웹 입구), MAIL(Mailpit 웹 주소)로 붙는다. 기본값은 E2E 스택(web/e2e/stack, Mailpit 8125)과 개발 서버(9501)다.
비밀번호는 시험 계정에만 쓰는 값이다.
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

BASE = os.environ.get("BASE", "http://127.0.0.1:9501")
MAIL = os.environ.get("MAIL", "http://127.0.0.1:8125")
PASSWORD = os.environ.get("AUDIT_PASSWORD", "audit-test-password-1")
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(method: str, path: str, body=None, headers=None, raw: bytes | None = None, ok=(200, 201, 202, 204)) -> tuple[int, Any]:
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = dict(headers or {})
    if body is not None and raw is None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with opener.open(req, timeout=60) as r:
            text = r.read().decode() or "null"
            return r.status, json.loads(text) if text.strip().startswith(("{", "[", "null")) else text
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        if e.code in ok:
            return e.code, text
        raise SystemExit(f"{method} {path} → {e.code} {text[:300]}")


def verify_token(email: str, wait_s: int = 30) -> str:
    q = urllib.parse.quote(f'to:"{email}"')
    for _ in range(wait_s):
        with urllib.request.urlopen(f"{MAIL}/api/v1/search?query={q}", timeout=10) as r:
            msgs = json.load(r).get("messages") or []
        if msgs:
            with urllib.request.urlopen(f"{MAIL}/api/v1/message/{msgs[0]['ID']}", timeout=10) as r:
                m = json.load(r)
            found = re.search(r"/app/verify\?token=([^\s\"'<>&]+)", (m.get("Text") or "") + (m.get("HTML") or ""))
            if found:
                return urllib.parse.unquote(found.group(1))
        time.sleep(1)
    raise SystemExit("확인 메일을 찾지 못했다(Mailpit)")


def signup() -> str:
    email = f"audit-{uuid.uuid4().hex[:10]}@example.com"
    call("POST", "/v1/auth/signup", {"email": email, "password": PASSWORD, "passwordConfirm": PASSWORD})
    call("POST", "/v1/auth/email/verify", {"token": verify_token(email)})
    login(email)
    return email


def login(email: str) -> None:
    call("POST", "/v1/auth/login", {"email": email, "password": PASSWORD})


def multipart(fields: dict, file_field: str, path: Path) -> tuple[bytes, str]:
    b = uuid.uuid4().hex
    out = b""
    for k, v in fields.items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    ctype = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    out += (f"--{b}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{b}--\r\n".encode()
    return out, f"multipart/form-data; boundary={b}"


def upload(child_id: str, photo: Path) -> Any:
    body, ctype = multipart({"childId": child_id}, "photo", photo)
    _, a = call("POST", "/v1/artworks", raw=body, headers={"Content-Type": ctype, "Idempotency-Key": str(uuid.uuid4())})
    return a


def wait(aid: str, done: set[str], limit_s: int) -> tuple[Any, float]:
    t0 = time.time()
    while True:
        _, a = call("GET", f"/v1/artworks/{aid}")
        if a["state"] in done:
            return a, time.time() - t0
        if time.time() - t0 > limit_s:
            raise SystemExit(f"{limit_s}초 안에 {done}에 닿지 않음: 지금 {a['state']} 단계 {a.get('stages')}")
        time.sleep(2)


PENDING = {"waiting", "running", "retrying"}  # contracts/openapi.yaml StageStatus 중 아직 안 끝난 것


def wait_stages(aid: str, limit_s: int) -> tuple[Any, float]:
    """보호자 화면 상태는 올리자마자 "전시 중"이라 상태로는 판정 끝을 알 수 없다. 작업이 모두 끝날 때까지 기다린다."""
    t0 = time.time()
    while True:
        _, a = call("GET", f"/v1/artworks/{aid}")
        st = a.get("stages") or []
        if st and not any(s.get("status") in PENDING for s in st):
            return a, time.time() - t0
        if not st and time.time() - t0 > 10:  # 활성 모델 버전이 없는 환경(E2E 스택)은 작업이 생기지 않는다
            return a, time.time() - t0
        if time.time() - t0 > limit_s:
            raise SystemExit(f"{limit_s}초 안에 작업이 끝나지 않음: {st}")
        time.sleep(2)
