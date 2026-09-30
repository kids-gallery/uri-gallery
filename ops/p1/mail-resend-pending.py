"""중계를 켠 뒤, Mailpit에 갇혀 있던 가입 확인 메일의 실제 수신자에게 새 확인 링크를 다시 보낸다(R-23 2026-09-30).

옛 메일을 그대로 내보내지 않는다 — 링크가 24시간 지나면 만료되고, 다시 보내기가 새 토큰을 발급하며 옛 토큰을 무효로 한다(R-24).
앱의 기존 경로 POST /v1/auth/email/verify/resend(항상 202, 가입 여부 비노출, 이미 확인한 계정엔 메일 없음)를 127.0.0.1:9521로 부른다.

  python3 ops/p1/mail-resend-pending.py            # 미리 보기(가린 주소·인원만)
  python3 ops/p1/mail-resend-pending.py --send     # 실제로 다시 보내기 — 중계가 켜져 있어야 한다
주소는 화면에 가려서만 보인다. 시험 주소(.test·.local·example·e2e)는 뺀다.
"""
import json
import subprocess
import sys
import urllib.request

SUBJECT = "[우리 아이 미술관] 이메일을 확인해 주세요"
TEST = (".test", ".local", "example.com", "example.test")


def mask(a: str) -> str:
    u, _, d = a.partition("@")
    return f"{u[:2]}***@{d}"


def main() -> int:
    send = "--send" in sys.argv
    msgs = json.load(urllib.request.urlopen("http://127.0.0.1:8025/api/v1/messages?limit=500"))["messages"]
    people = sorted({t["Address"].strip().lower() for m in msgs if m["Subject"] == SUBJECT for t in m["To"]
                     if not t["Address"].lower().endswith(TEST) and "e2e" not in t["Address"].lower()})
    print(f"대상 {len(people)}명:", ", ".join(mask(p) for p in people))
    if not send:
        print("미리 보기 — 보내려면 --send (중계가 켜져 있어야 한다: ops/checklist/check-mail-relay.sh)")
        return 0
    chk = subprocess.run(["ops/checklist/check-mail-relay.sh"], capture_output=True, text=True)
    if chk.returncode != 0:
        print("중계가 준비되지 않아 보내지 않는다:\n" + chk.stdout)
        return 1
    for p in people:
        req = urllib.request.Request("http://127.0.0.1:9521/v1/auth/email/verify/resend", method="POST",
                                     data=json.dumps({"email": p}).encode(), headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"{mask(p)} → {r.status}")
    print("끝 — Mailpit 화면(127.0.0.1:8025)에서 새 메일이 중계됐는지 확인")
    return 0


if __name__ == "__main__":
    sys.exit(main())
