#!/usr/bin/env bash
# 점검(2026-09-30): 본문 상한 초과가 nginx HTML이 아니라 413 application/problem+json(계약 PayloadTooLarge)인지 본다.
# 사용: ops/checklist/check-413.sh [BASE]   (기본 https://p1.sumzip.com) — 22MB 임시 파일을 올린다(로그인 없이, 저장되지 않음)
set -u
BASE="${1:-https://p1.sumzip.com}"
f=$(mktemp); head -c 23068672 /dev/zero > "$f"
fail=0
for p in /v1/artworks /v1/models/segment; do
  out=$(curl -s -o /dev/null -m 60 -w '%{http_code} %{content_type}' -F "photo=@$f;type=image/png" "$BASE$p")
  if [[ "$out" == "413 application/problem+json"* ]]; then echo "ok   $p → $out"; else echo "FAIL $p → $out (기대: 413 application/problem+json)"; fail=1; fi
done
rm -f "$f"; exit $fail
