#!/usr/bin/env bash
# 점검표 C2(2026-09-30): /model-api/* 가 웹 화면(SPA index.html 200)으로 떨어지면 실패한다.
# 공개 범위 팀 결정 전 기대값: 404 application/problem+json (SD_04 §내부망 배치, DEPLOY §7).
# 사용: ops/checklist/check-model-api-route.sh [BASE]   (기본 https://p1.sumzip.com)
set -u
BASE="${1:-https://p1.sumzip.com}"
fail=0
for p in /model-api /model-api/ /model-api/health /model-api/docs /model-api/openapi.json /model-api/predict; do
  out=$(curl -s -o /dev/null -m 10 -w '%{http_code} %{content_type}' "$BASE$p")
  code=${out%% *}; ctype=${out#* }
  if [[ "$code" == 404 && "$ctype" == application/problem+json* ]]; then echo "ok   $p → $out"
  else echo "FAIL $p → $out (기대: 404 application/problem+json)"; fail=1; fi
done
# 회귀: 기존 경로는 그대로여야 한다
for pc in "/live 200" "/v1/models/openapi.json 200" "/internal/ready 404"; do
  p=${pc% *}; want=${pc#* }; code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BASE$p")
  if [[ "$code" == "$want" ]]; then echo "ok   $p → $code"; else echo "FAIL $p → $code (기대: $want)"; fail=1; fi
done
exit $fail
