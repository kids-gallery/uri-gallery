"""컨테이너 묶음 시험(SD_04 10-6) — 브라우저 대신 API로 한 바퀴를 돌고 결과를 JSON으로 남긴다.

  python3 ops/docker/smoke.py flow  [사진]     # 가입 → 아이 → 올리기 → 판정 → 확정 → 결과 → 승인
  python3 ops/docker/smoke.py engine-down [사진] # 엔진을 멈춘 채로 올리기 → 판정 재시도 소진 → 원본 액자로 남는지
  python3 ops/docker/smoke.py check [이메일]    # 같은 계정으로 다시 로그인해 작품·파일이 남아 있는지(재생성 뒤)

표준 라이브러리만 쓴다. 기본 주소 http://localhost:9501(입구), 메일 http://localhost:8025(Mailpit).
비밀번호는 이 시험 계정에만 쓰는 값이다. 결과는 표준 출력의 마지막 줄 JSON.
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

BASE = os.environ.get("BASE", "http://localhost:9501")
MAIL = os.environ.get("MAIL", "http://localhost:8025")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "smoke-test-password-1")
STATE_FILE = Path(os.environ.get("SMOKE_STATE", ".data/smoke-account.json"))
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
    email = f"smoke-{uuid.uuid4().hex[:10]}@example.com"
    call("POST", "/v1/auth/signup", {"email": email, "password": PASSWORD, "passwordConfirm": PASSWORD})
    call("POST", "/v1/auth/email/verify", {"token": verify_token(email)})
    login(email)
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
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
        if time.time() - t0 > limit_s:
            raise SystemExit(f"{limit_s}초 안에 작업이 끝나지 않음: {st}")
        time.sleep(2)


def brief(a: Any) -> dict:
    return {k: a.get(k) for k in ("state", "exhibited", "hungResultKind", "suggestion", "confirmedKind", "choices", "notDelivered", "downgrade")} | {
        "stages": a.get("stages"),
        "cutout": bool(a.get("cutoutUrl")), "result": (a.get("result") or {}).get("kind") if isinstance(a.get("result"), dict) else a.get("result")}


def run_flow(photo: Path, engine_down: bool) -> dict:
    email = signup()
    _, child = call("POST", "/v1/children", {"alias": "시험"})
    a = upload(child["id"], photo)
    report = {"mode": "engine-down" if engine_down else "flow", "email": email, "artworkId": a["id"], "afterUpload": brief(a)}
    a, t = wait_stages(a["id"], 900)
    report["judged"] = brief(a) | {"seconds": round(t, 1)}
    if not engine_down:
        kind = "relief" if "relief" in (a.get("choices") or []) else "frame"
        call("POST", f"/v1/artworks/{a['id']}/confirm", {"kind": kind})
        a, t = wait_stages(a["id"], 1200)
        report["made"] = brief(a) | {"confirmed": kind, "seconds": round(t, 1)}
        if a["state"] == "awaiting_review":
            call("POST", f"/v1/artworks/{a['id']}/decision", {"decision": "like"})
            _, a = call("GET", f"/v1/artworks/{a['id']}")
        report["final"] = brief(a)
    STATE_FILE.write_text(json.dumps({"email": email, "artworkId": report["artworkId"]}))
    return report


def run_check(email: str | None) -> dict:
    saved = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    email = email or saved.get("email") or ""
    login(email)
    _, a = call("GET", f"/v1/artworks/{saved['artworkId']}")
    url = a.get("photoUrl") or a.get("originalUrl")
    status, size, kind = None, 0, None
    if url:
        with opener.open(urllib.request.Request(BASE + url), timeout=60) as r:  # 사진은 바이트 그대로 받는다
            data = r.read()
            status, size, kind = r.status, len(data), r.headers.get("Content-Type")
    return {"mode": "check", "email": email, "artwork": brief(a), "photo": {"status": status, "bytes": size, "type": kind}}


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "flow"
    arg = sys.argv[2] if len(sys.argv) > 2 else None
    if mode == "check":
        out = run_check(arg)
    else:
        out = run_flow(Path(arg or "ops/docker/sample-drawing.png"), engine_down=(mode == "engine-down"))
    print(json.dumps(out, ensure_ascii=False))
