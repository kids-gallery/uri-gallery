"""개발 환경에서 M1·M2·M5(TorchServe가 응답하면 M3도)를 켠다(SD_04 9-4). 첫 활성 한 줄(D27 예외)만 개발 DB에 직접 쓰고, 나머지는 정식 절차다.

  serving/.venv/bin/python scripts/dev_activate_models.py [--eval-dir <팀 평가 묶음 사진 폴더>]

순서: 평가 담당 계정(ops:staff) → 평가 항목(ops:eval-items) → 후보 등록(ops.models register 본문 → POST versions)
      → 첫 활성(candidate → active, D27과 같은 조건, 개발 DB만) → 지금 불러오기(POST /v1/ops/models/:id/warmup) → 평가(POST evaluate, 워커가 처리) → 판단(PATCH eval-runs).
  정식 승격(POST promote)은 활성 버전이 없는 모델을 평가할 수 없어(SD_04 9-4) 첫 활성에 쓰지 못한다.
- 저장소 루트 .env를 읽는다. DB_HOST가 127.0.0.1·localhost가 아니면 멈춘다(팀 DB 보호).
- --eval-dir이 없으면 개발 확인용 그림 2장(코드로 그린 사람·집)을 .data/dev-eval/에 만들어 쓴다.
  이때 판단 근거에 "[개발 환경 연결 확인, 품질 판단 아님]"을 적는다.
- 평가는 이 기기에서 모델이 실제로 도는지 기록하려고 돌린다. 결과(경로·처리 시간)를 그대로 출력한다.
"""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEEDS_M3 = {"M2"}  # 판정 평가 사슬에 M3 관절이 있다


STAFF_EMAIL = os.environ.get("DEV_EVALUATOR_EMAIL", "dev-evaluator@example.com")
STAFF_PW = os.environ.get("DEV_EVALUATOR_PASSWORD", "dev-evaluator-password-1")
DEV_NOTE = "[개발 환경 연결 확인, 품질 판단 아님]"


def load_env() -> dict:
    env = dict(os.environ)
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env.setdefault(k.strip(), v.strip())
    return env


ENV = load_env()
API = f"http://127.0.0.1:{ENV.get('APP_PORT', '9521')}"


def torchserve_up() -> bool:
    try:
        with urllib.request.urlopen(ENV.get("TORCHSERVE_URL", "http://127.0.0.1:9561").rstrip("/") + "/ping", timeout=5) as r:
            return "Healthy" in r.read().decode()
    except OSError:
        return False


M3_UP = torchserve_up()
MODELS = ["M1", "M3", "M2", "M5"] if M3_UP else ["M1", "M2", "M5"]  # M3은 이 기기에서 TorchServe가 응답할 때만(SD_04 9-4)
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def call(method: str, path: str, body=None, ok_conflict=False):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method,
                                 headers={"Content-Type": "application/json", "Origin": ENV.get("APP_BASE_URL", API)})
    try:
        with opener.open(req, timeout=60) as r:
            t = r.read().decode()
            return r.status, json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        if ok_conflict and e.code == 409:
            return 409, json.loads(t)
        raise SystemExit(f"{method} {path} → {e.code} {t[:300]}")


def run(cmd: list[str], cwd: Path, stdin: str | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, env=ENV, input=stdin, text=True, capture_output=True)


def dev_eval_set() -> Path:
    """개발 확인용 그림 2장과 매니페스트. 실제 아이 그림·공개 이미지가 아니다(BR-MDL-04)."""
    from PIL import Image, ImageDraw
    d = ROOT / ".data" / "dev-eval"
    d.mkdir(parents=True, exist_ok=True)
    w = 640
    im = Image.new("RGB", (w, w), "#fbfaf6"); g = ImageDraw.Draw(im)
    g.ellipse((260, 90, 380, 210), outline="#d0392b", width=10)
    for a, b in [((320, 210), (320, 420)), ((320, 260), (200, 330)), ((320, 260), (440, 330)), ((320, 420), (240, 560)), ((320, 420), (400, 560))]:
        g.line((a, b), fill="#2c6fb7", width=12)
    im.save(d / "person.png")
    im = Image.new("RGB", (w, w), "#fbfaf6"); g = ImageDraw.Draw(im)
    g.rectangle((170, 300, 470, 540), outline="#8a5a2b", width=12); g.polygon([(140, 310), (320, 150), (500, 310)], outline="#c0392b", width=12)
    g.rectangle((290, 420, 350, 540), outline="#2f6b3a", width=10)
    im.save(d / "house.png")
    if (d / "manifest.yaml").exists():  # 등록 CLI가 받은 id를 되적은 매니페스트 — 다시 쓰면 중복 등록된다
        return d
    (d / "manifest.yaml").write_text(
        "# 개발 확인용 평가 묶음(SD_04 9-4). 코드로 그린 그림 2장. 팀 평가 묶음이 아니다.\nitems:\n"
        "  - {id: null, category: person, expected_path: animated, maker: 이제민, file: person.png, note: \"개발 확인용 막대 사람(코드로 그림)\"}\n"
        "  - {id: null, category: non_person, expected_path: relief, maker: 이제민, file: house.png, note: \"개발 확인용 집(코드로 그림)\"}\n",
        encoding="utf-8")
    return d


def activate(model_id: str, version_id: int) -> None:
    """첫 활성(D27 예외, SD_04 9-4). 활성 버전이 없고 라이선스 확인된 후보일 때만 바꾼다. 개발 DB만."""
    sys.path.insert(0, str(ROOT / "serving"))
    os.environ.update({k: v for k, v in ENV.items() if k.startswith("DB_")})
    from common.db import connect, tx
    conn = connect()
    with tx(conn) as cur:
        cur.execute("""UPDATE model_version SET release_state = 'active'
                        WHERE version_id = %s AND model_id = %s AND release_state = 'candidate' AND license_confirmed = TRUE
                          AND NOT EXISTS (SELECT 1 FROM (SELECT version_id FROM model_version WHERE model_id = %s AND release_state = 'active') a)""",
                    (version_id, model_id, model_id))
    conn.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval-dir", help="팀 평가 묶음 사진 폴더(eval/items/manifest.yaml의 file 기준)")
    a = ap.parse_args()
    if ENV.get("DB_HOST") not in ("127.0.0.1", "localhost"):
        print("DB_HOST가 이 기기가 아니다. 팀 DB 승격은 운영 화면(S11)에서 한다."); return 2

    # 1 평가 담당 계정(이미 있으면 그대로)
    run(["npm", "run", "-s", "ops:staff", "--", "add", "--email", STAFF_EMAIL, "--role", "operator,evaluator,integrator"], ROOT / "api", STAFF_PW + "\n")
    call("POST", "/v1/ops/auth/login", {"email": STAFF_EMAIL, "password": STAFF_PW})

    # 2 평가 항목(G20). 매니페스트에 받은 id를 되적으므로 팀 매니페스트는 복사본으로 등록한다
    if a.eval_dir:
        man = ROOT / ".data" / "dev-eval" / "team-manifest.yaml"; man.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / "eval" / "items" / "manifest.yaml", man)
        text = man.read_text(encoding="utf-8")
        import re
        man.write_text(re.sub(r"id: \d+,", "id: null,", text), encoding="utf-8")
        src, note = Path(a.eval_dir), "팀 평가 묶음으로 개발 환경에서 확인"
    else:
        src = dev_eval_set(); man, note = src / "manifest.yaml", DEV_NOTE
    r = run(["npm", "run", "-s", "ops:eval-items", "--", "import", "--manifest", str(man), "--dir", str(src), "--by", STAFF_EMAIL], ROOT / "api")
    print("평가 항목:", (r.stdout or r.stderr).strip().splitlines()[-1:] )

    report = {}
    for m in MODELS:
        _, view = call("GET", "/v1/admin/models")
        vers = next((x for x in view if x.get("modelId") == m), {}).get("versions", [])
        ver = next((v for v in vers if v.get("releaseState") == "active"), None)
        if ver is None:
            ver = next((v for v in vers if v.get("releaseState") == "candidate" and v.get("licenseConfirmed")), None)
            if ver is None:
                body = json.loads(run([str(ROOT / "serving/.venv/bin/python"), "-m", "ops.models", "register", m, "--label", f"dev-{time.strftime('%m%d%H%M')}"], ROOT / "serving").stdout)
                _, ver = call("POST", f"/v1/admin/models/{m}/versions", body)
            activate(m, int(ver["id"]))
            time.sleep(25)  # 워커가 활성 버전을 20초마다 다시 읽는다 — 그 전에 부르면 꺼진 모델로 보고 요청을 지운다
        report[m] = {"version": ver.get("version"), "active": True}
        call("POST", f"/v1/ops/models/{m}/warmup", {})  # 워커는 기동 때만 미리 올린다 — 나중에 켠 모델은 "지금 불러오기"로 올린다
        if m in NEEDS_M3 and not M3_UP:
            report[m]["eval_skipped"] = "평가 실행기가 M3(관절)도 적재돼 있어야 맡는다(workers/stages/eval.py CHAIN). M3은 x86 엔진 검증 뒤"
            continue
        run_id = ver.get("latestEvalRunId")
        ev = call("GET", f"/v1/admin/eval-runs/{run_id}")[1] if run_id else call("POST", f"/v1/admin/models/{m}/evaluate", {"versionId": str(ver["id"])})[1]
        t0 = time.time()
        while ev["doneCount"] + ev["incompleteCount"] < ev["itemTotal"] and time.time() - t0 < 900:
            time.sleep(3); _, ev = call("GET", f"/v1/admin/eval-runs/{ev['id']}")
        report[m]["eval"] = [{"status": x["status"], "expected": x["expectedPath"], "actual": x["actualPath"], "ms": x["durationMs"]} for x in ev["results"]]
        if ev["doneCount"] + ev["incompleteCount"] < ev["itemTotal"]:
            report[m]["eval_note"] = f"15분 안에 끝나지 않음 {ev['doneCount']}/{ev['itemTotal']}"
        elif ev.get("verdict") is None:
            call("PATCH", f"/v1/admin/eval-runs/{ev['id']}", {"verdict": "pass" if ev["incompleteCount"] == 0 else "hold",
                                                          "rationale": f"{note}. 첫 활성은 D27 예외(SD_04 9-4)"})
    print(json.dumps(report, ensure_ascii=False))
    return 0 if all(not r.get("eval_note") for r in report.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
