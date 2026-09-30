#!/bin/zsh
# 진짜 응답 감시(D48 ④, SD_02 §17-17): 200만 보지 않고 내용까지 본다. 하나라도 틀리면 0 아닌 종료.
# 사용: ops/checklist/check-live.sh [주소, 기본 https://p1.sumzip.com]   EXPECT_COMMIT=abc1234 이면 배포 커밋도 대조
set -uo pipefail
URL=${1:-https://p1.sumzip.com}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
fail=0
# check 이름 경로 기대코드 기대형식 파이썬식(본문 b · JSON j)
check() {
  local name=$1 p=$2 want=$3 ctype=$4 expr=$5
  local meta; meta=$(curl -s -o "$TMP/b" -w '%{http_code} %{content_type}' -H 'Cache-Control: no-cache' "$URL$p")
  local code=${meta%% *} ct=${meta#* }
  local ok; ok=$(python3 - "$TMP/b" "$expr" <<'PY'
import json, sys
b = open(sys.argv[1], encoding='utf-8', errors='replace').read()
try: j = json.loads(b)
except Exception: j = None
try: print('1' if eval(sys.argv[2], {'b': b, 'j': j}) else '0')
except Exception: print('0')
PY
)
  if [[ "$code" == "$want" && "$ct" == ${ctype}* && "$ok" == 1 ]]; then echo "PASS $name"; else echo "FAIL $name — $code $ct · 본문: $(head -c 160 "$TMP/b" | LC_ALL=C tr -d '\n')"; fail=1; fi
}
check "살아 있음 /live"            /live               200 application/json "j['status'] == 'live'"
check "준비 /ready"                /ready              200 application/json "j['status'] == 'ready'"
check "모델 상태 /v1/models/health" /v1/models/health  200 application/json "j['status'] == 'ok' and j['functions'] and all(v in ('ready', 'disabled') for v in j['functions'].values())"
check "웹 첫 화면"                  /                   200 text/html        "'<title>우리 아이 미술관</title>' in b and 'id=\"app\"' in b"
check "배포 버전 /version.json"     /version.json       200 application/json "len(j['commit']) >= 7 and j['deployedAt']"
check "공개 안 한 모델 API"         /model-api/health   404 application/problem+json "j['code'] == 'not_found'"
check "없는 API"                    /v1/nope            404 application/problem+json "j['code'] == 'not_found' and 'requestId' in j"
if [[ -n "${EXPECT_COMMIT:-}" ]]; then
  check "배포 커밋 = $EXPECT_COMMIT" /version.json 200 application/json "j['commit'] == '$EXPECT_COMMIT'"
fi
[[ $fail == 0 ]] && echo "모두 통과 — $URL" || echo "틀린 항목이 있어요 — $URL"
exit $fail
