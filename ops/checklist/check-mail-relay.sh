#!/usr/bin/env bash
# 메일 실제 발송 점검(R-23 2026-09-30, DEPLOY §7): Mailpit → Gmail SMTP 자동 중계가 켜져 있고 비밀값이 새지 않는지 본다. 값은 출력하지 않는다.
# 사용: ops/checklist/check-mail-relay.sh [시험 받을 주소]   — 주소를 주면 그 주소로 시험 메일 1통을 보낸다(본인 주소만).
set -u
cd "$(dirname "$0")/../.."
F=.data/mailpit-relay.yaml; fail=0
ok() { echo "ok   $*"; }; no() { echo "FAIL $*"; fail=1; }
[ -f "$F" ] && ok "중계 설정 파일 있음" || no "중계 설정 파일 없음 — ops/p1/mailpit-relay.example.yaml을 $F 로 복사해 채운다"
if [ -f "$F" ]; then
  [ "$(stat -f '%Lp' "$F")" = 600 ] && ok "권한 600" || no "권한이 600이 아님(chmod 600 $F)"
  git check-ignore -q "$F" && ok "git 제외" || no "git 추적 대상 — .gitignore 확인"
  for k in username password override-from; do grep -Eq "^$k: *\"?[^\" ]+" "$F" && ok "$k 채워짐" || no "$k 비어 있음"; done
fi
pid=$(pm2 jlist | python3 -c "import sys,json;print(next((p['pid'] for p in json.load(sys.stdin) if p['name']=='mailpit'),''))")
args=$(ps -o command= -p "$pid" 2>/dev/null)
echo "$args" | grep -q -- "--smtp-relay-all" && ok "mailpit이 중계 켜고 떠 있음(PID $pid)" || no "mailpit에 중계 인자 없음 — 파일을 만든 뒤 pm2 restart mailpit"
echo "$args" | grep -Eqi "password|passwd|app.?pass" && no "실행 인자에 비밀번호 흔적(D8)" || ok "실행 인자에 비밀값 없음"
if [ -n "${1:-}" ] && [ "$fail" = 0 ]; then
  python3 - "$1" <<'PY'
import smtplib, sys
from email.message import EmailMessage
m = EmailMessage(); m["From"] = "no-reply@p1.sumzip.com"; m["To"] = sys.argv[1]
m["Subject"] = "[우리 아이 미술관] 발송 시험"; m.set_content("실제 발송 경로(Mailpit → Gmail SMTP) 시험 메일입니다. 받으셨으면 이 메일은 지우셔도 됩니다.")
with smtplib.SMTP("127.0.0.1", 1025) as s: s.send_message(m)
print("sent 시험 메일 1통 → 받은편지함(스팸함 포함)을 확인")
PY
fi
exit $fail
