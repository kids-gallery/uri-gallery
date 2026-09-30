#!/usr/bin/env bash
# 사진 자산 서빙(SD_04 §3-3, DEPLOY §7): manifest.json은 no-cache, 면 사진은 1년 immutable, 없는 사진은 404(웹 화면 200으로 떨어지지 않음).
# 사용: ops/checklist/check-photo-cache.sh [BASE] [면 경로]   예) … http://127.0.0.1:9911 /museum/photos/test-node-v1/1024/pz.webp
set -u
BASE="${1:-https://p1.sumzip.com}"; FACE="${2:-}"
fail=0
hdr() { curl -s -o /dev/null -D - -m 10 "$BASE$1" | tr -d '\r'; }
m=$(hdr /museum/photos/manifest.json)
if echo "$m" | grep -q "^HTTP/1.1 200" && echo "$m" | grep -qi "^cache-control: no-cache"; then echo "ok   manifest.json 200 no-cache"; else echo "FAIL manifest.json → $(echo "$m" | grep -iE '^HTTP|^cache-control' | tr '\n' ' ')"; fail=1; fi
if [ -n "$FACE" ]; then
  f=$(hdr "$FACE")
  if echo "$f" | grep -q "^HTTP/1.1 200" && echo "$f" | grep -qi "^cache-control:.*immutable"; then echo "ok   면 사진 200 immutable"; else echo "FAIL 면 사진 → $(echo "$f" | grep -iE '^HTTP|^cache-control' | tr '\n' ' ')"; fail=1; fi
fi
n=$(curl -s -o /dev/null -m 10 -w '%{http_code} %{content_type}' "$BASE/museum/photos/no-such-node-v0/1024/pz.webp")
if [[ "$n" == 404* ]]; then echo "ok   없는 사진 → $n"; else echo "FAIL 없는 사진 → $n (기대 404 — 웹 화면으로 떨어지면 안 됨)"; fail=1; fi
exit $fail
