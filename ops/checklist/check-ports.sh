#!/usr/bin/env bash
# 점검 가이드 A6(2026-09-30): 우리 서비스(pm2 프로세스와 그 자식)가 듣는 포트가 설계서(SD_04 내부망 배치)에 적힌 것뿐인지 본다.
# 허용: 9501(입구) · 9521(app-api) · 9541(model-api) · 9561~9565(TorchServe) · 9566~9579(TorchServe 작업자) · 1025·8025(mailpit)
set -u
fail=0
pids=$(pm2 jlist | python3 -c "import sys,json;print(' '.join(str(p['pid']) for p in json.load(sys.stdin) if p['pid']))")
all="$pids"; for p in $pids; do all="$all $(pgrep -P $p | tr '\n' ' ')"; for c in $(pgrep -P $p); do all="$all $(pgrep -P $c | tr '\n' ' ')"; done; done
for p in $all; do
  lsof -nP -a -p "$p" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $1, $9}'
done | sort -u | while read -r name addr; do
  port=${addr##*:}
  if [[ "$port" =~ ^(9501|9521|9541|1025|8025)$ ]] || { [ "$port" -ge 9561 ] && [ "$port" -le 9579 ]; }; then echo "ok   $name $addr"
  else echo "FAIL $name $addr (설계서 밖 포트)"; echo x >> /tmp/.check-ports-fail.$$; fi
done
[ -f /tmp/.check-ports-fail.$$ ] && { rm -f /tmp/.check-ports-fail.$$; exit 1; }; exit 0
