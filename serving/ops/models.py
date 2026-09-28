"""모델 운영 CLI — 모델을 추가·준비할 때 적재 시간을 재서 매니페스트에 남기고, 버전 등록 SQL을 만든다.

  python -m ops.models status                    # 매니페스트·DB 활성 버전·워커 적재 상태·llm-server 상태
  python -m ops.models check M6                  # Ollama 태그·블롭 다이제스트가 매니페스트와 같은지
  python -m ops.models prepare M6                # 준비 절차 안내(실행하지 않음: 공유 Ollama에서 pull은 사람이 1회)
  python -m ops.models measure M6 [--write]      # 적재 시간·첫 응답 시간 실측 → load.expected_seconds
  python -m ops.models measure M5 [--write]      # 파이썬 어댑터 load() 실측(torch 필요)
  python -m ops.models register M6 --label L [--apply]   # model_version 후보 등록(기본은 SQL만 출력)

활성화(승격)는 여기서 하지 않는다 — 평가 담당의 승격 절차(G22, release_event)만 활성 버전을 바꾼다.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import socket
import sys
import time

import yaml

from common.config import SERVING_ROOT, load_manifest, load_settings
from common.model_state import describe, read_all


def _manifest_write(data: dict) -> None:
    p = load_settings().manifest_path
    head = []
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if line.startswith("#"):
                head.append(line)
            else:
                break
    p.write_text("\n".join(head) + ("\n" if head else "") + yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
                 encoding="utf-8")


def config_hash(model_id: str) -> str:
    h = hashlib.sha256()
    if model_id == "M6":
        from llm_server import caption as c
        h.update(json.dumps({"system": c.SYSTEM, "options": c.GEN_OPTIONS, "max_regen": c.MAX_REGEN, "think": False,
                             "keep_alive": "5m", "no_think_suffix": True}, ensure_ascii=False, sort_keys=True).encode())
    elif model_id == "M2":
        h.update((SERVING_ROOT / "config" / "m2_prompts.yaml").read_bytes())
    elif model_id == "M4":
        h.update((SERVING_ROOT / "config" / "m4_rules.yaml").read_bytes())
    else:
        from adapters.registry import build_adapter
        h.update(json.dumps(getattr(build_adapter(model_id, fake=False), "CONFIG", {}), sort_keys=True).encode())
    return h.hexdigest()


# ── status ─────────────────────────────────────────────────────────────
def cmd_status(_args) -> int:
    man = load_manifest().get("models", {})
    print("매니페스트")
    for mid, m in man.items():
        ld = m.get("load") or {}
        print(f"  {mid}  license={m.get('license_confirmed')}  device={m.get('exec_device')}  "
              f"load≈{ld.get('expected_seconds')}s (측정 {ld.get('measured_on')}, {ld.get('measured_at')})")
    try:
        from common.db import connect, tx
        with tx(connect()) as cur:
            cur.execute("SELECT model_id, version_label, license_confirmed, exec_device FROM model_version WHERE release_state='active'")
            rows = cur.fetchall()
        print("DB 활성 버전")
        for r in rows:
            print(f"  {r['model_id']}  {r['version_label']}  license={bool(r['license_confirmed'])}  device={r['exec_device']}")
    except Exception:
        print("DB 활성 버전: (DB에 연결하지 못함)")
    print("워커 적재 상태")
    for w in read_all(load_settings().run_dir):
        print(f"  {w['worker']} [{w['serving_group']}] alive={w['alive']}")
        for mid, m in w["models"].items():
            d = describe(m)
            extra = f" 경과 {d['elapsedSeconds']}s / 남음≈{d['remainingSeconds']}s" if d["state"] == "loading" else ""
            print(f"    {mid}: {d['state']}{extra} last={d['lastLoadSeconds']}s")
    try:
        import urllib.request
        with urllib.request.urlopen(load_settings().llm_server_url + "/v1/ready", timeout=3) as r:
            print("llm-server", json.dumps(json.load(r), ensure_ascii=False))
    except Exception:
        print("llm-server: (응답 없음 — P0에서는 띄우지 않는다)")
    return 0


# ── M6 (Ollama) ────────────────────────────────────────────────────────
def cmd_check(args) -> int:
    if args.model != "M6":
        print("check는 M6(Ollama)만. 파이썬 모델은 measure로 적재를 확인한다"); return 2
    from llm_server import ollama_client as oc
    want = (load_manifest()["models"].get("M6") or {}).get("weights_sha256")
    if oc.version() is None:
        print("Ollama 응답 없음 — 공유 서버 장애. 직접 복구하지 말고(ollama serve 금지) 관리자에게 알린다"); return 1
    if not any(t.get("name") == oc.CHAT_MODEL for t in oc.tags()):
        print(f"{oc.CHAT_MODEL} 없음 — `python -m ops.models prepare M6` 절차를 따른다"); return 1
    got = oc.blob_digest()
    print(f"tag={oc.CHAT_MODEL} digest={got}\nmanifest={want}\n일치={got == want}")
    return 0 if got == want else 1


def cmd_prepare(args) -> int:
    if args.model == "M6":
        print("""M6 준비(배포 전 1회, 사람이 실행 — 런타임 코드에는 pull이 없다)
  1) ollama list | grep -x 'qwen3:4b.*'      # 이미 있으면 받지 않는다(Studio-B 공유 서버에는 있음)
  2) 없으면: ollama pull qwen3:4b            # 태그 명시, 2.5GB(10GB 한도 안)
  3) python -m ops.models check M6            # 블롭 다이제스트 = 매니페스트
  4) python -m ops.models measure M6 --write  # 적재 시간 → load.expected_seconds
  금지: ollama rm·stop·create(접두사 없는 이름)·serve, keep_alive -1, :cloud 모델""")
    else:
        print(f"""{args.model} 준비
  1) pip install -e '.[models]'   (torch 등, 별도 venv 권장)
  2) 가중치를 MODEL_ROOT 아래 받는다 — HF 리비전을 고정하고 SHA-256을 매니페스트에 기록(T070·T082)
  3) python -m ops.models measure {args.model} --write""")
    return 0


def _measure_m6() -> dict:
    from llm_server import ollama_client as oc
    loaded = [p for p in oc.loaded() if p.get("name") == oc.CHAT_MODEL]
    out = {"cold_load_s": None, "first_reply_s": None}
    if loaded:
        print("이미 메모리에 올라가 있어 적재 시간을 잴 수 없다(공유 서버에서 ollama stop 금지). "
              "keep_alive(5분)가 지나 내려간 뒤 다시 잰다. 응답 시간만 잰다.")
    else:
        from llm_server import caption as c
        out["cold_load_s"] = round(oc.warm(num_ctx=c.GEN_OPTIONS["num_ctx"]), 2)
    t = time.monotonic()
    r = oc.chat([{"role": "user", "content": "한 단어로 대답해: 하늘 색은?"}], options={"num_ctx": 2048, "num_predict": 16})
    out["first_reply_s"] = round(time.monotonic() - t, 2)
    out["ollama_load_s"] = round(r["load_s"], 2)
    out["think_leak"] = "<think>" in r["content"]
    return out


def _measure_python(model_id: str) -> dict:
    from adapters.registry import build_adapter
    a = build_adapter(model_id, fake=False)
    t = time.monotonic()
    a.load()
    return {"cold_load_s": round(time.monotonic() - t, 2), "device": getattr(a, "device", None)}


def cmd_measure(args) -> int:
    res = _measure_m6() if args.model == "M6" else _measure_python(args.model)
    print(json.dumps(res, ensure_ascii=False))
    if args.write:
        if res.get("cold_load_s") is None:
            print("적재 시간을 재지 못해 매니페스트를 고치지 않는다"); return 1
        data = load_manifest()
        m = data["models"].setdefault(args.model, {})
        m["load"] = {"expected_seconds": res["cold_load_s"], "measured_on": socket.gethostname(),
                     "measured_at": dt.date.today().isoformat()}
        m["config_hash"] = config_hash(args.model)
        _manifest_write(data)
        print(f"매니페스트 {args.model}.load.expected_seconds = {res['cold_load_s']}")
    return 0


# ── register ───────────────────────────────────────────────────────────
def cmd_register(args) -> int:
    m = load_manifest()["models"].get(args.model)
    if not m:
        print("매니페스트에 없는 모델"); return 2
    if not m.get("weights_sha256"):
        print("weights_sha256이 비어 있다 — 재현 기록(T070·T082·T126) 뒤 등록한다"); return 2
    ch = m.get("config_hash") or config_hash(args.model)
    sql = ("INSERT INTO model_version (model_id, version_label, weights_sha256, runtime, config_hash, model_path, "
           "license_confirmed, release_state, exec_device) VALUES (%s,%s,%s,%s,%s,%s,%s,'candidate',%s)")
    vals = (args.model, args.label, m["weights_sha256"], m.get("runtime"), ch, m.get("ollama_tag") or m.get("source"),
            bool(m.get("license_confirmed")), m.get("exec_device"))
    if not args.apply:
        print(sql % tuple(repr(v) for v in vals) + ";\n(--apply를 붙이면 DB에 넣는다. 후보로만 — 활성화는 승격 절차)")
        return 0
    from common.db import connect, tx
    with tx(connect()) as cur:
        cur.execute(sql, vals)
        print(f"등록: version_id={cur.lastrowid} (candidate)")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="ops.models")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    for name in ("check", "prepare"):
        p = sub.add_parser(name); p.add_argument("model")
    p = sub.add_parser("measure"); p.add_argument("model"); p.add_argument("--write", action="store_true")
    p = sub.add_parser("register"); p.add_argument("model"); p.add_argument("--label", required=True)
    p.add_argument("--apply", action="store_true")
    a = ap.parse_args(argv)
    return {"status": cmd_status, "check": cmd_check, "prepare": cmd_prepare,
            "measure": cmd_measure, "register": cmd_register}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
