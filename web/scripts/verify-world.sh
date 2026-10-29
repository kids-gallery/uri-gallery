#!/usr/bin/env bash
# Local verification only. Does not install, publish, upload, commit, or touch a user's browser profile.
# WORLD_REVIEW_GPU=1 selects installed Chrome and rejects software rendering; default keeps SwiftShader.
set -u
WEB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-/private/tmp/uam-world-review-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
cd "$WEB_DIR" || exit 2
if ! curl --fail --silent --max-time 5 http://127.0.0.1:5173/app/world > /dev/null; then
  echo '개발 서버가 필요합니다: web에서 npm run dev -- --host 127.0.0.1 --port 5173'
  exit 2
fi
FAILED=0
run_check() {
  local label="$1"
  shift
  if "$@" > "$OUT/$label.log" 2>&1; then
    printf '%s\t0\n' "$label" >> "$OUT/exit-codes.tsv"
    echo "PASS $label"
  else
    local code=$?
    printf '%s\t%s\n' "$label" "$code" >> "$OUT/exit-codes.tsv"
    echo "FAIL $label ($code): $OUT/$label.log"
    FAILED=1
  fi
}
run_check lint npm run lint
run_check unit npm test
run_check production-build npm run build
run_check localtest-build ./node_modules/.bin/vite build --mode localtest --outDir "$OUT/localtest-dist"
run_check family node scripts/world-family-review.mjs "$OUT/family"
run_check space node scripts/world-space-review.mjs "$OUT/space"
run_check motion node scripts/world-motion-review.mjs "$OUT/motion"
run_check social node scripts/world-social-review.mjs "$OUT/social"
run_check visual node scripts/world-volume-review.mjs "$OUT/visual"
run_check play node scripts/world-play-review.mjs "$OUT/play"
run_check controls node scripts/world-controls-review.mjs "$OUT/controls"
run_check building node scripts/world-building-review.mjs "$OUT/building"
run_check interior node scripts/world-interior-review.mjs "$OUT/interior"
run_check feel node scripts/world-feel-review.mjs "$OUT/feel"
run_check rework node scripts/world-rework-review.mjs "$OUT/rework"
run_check firstrun node scripts/world-firstrun-review.mjs "$OUT/firstrun"
run_check start node scripts/world-start-review.mjs "$OUT/start"
run_check release node scripts/world-release-review.mjs "$OUT/release"
echo "검사 근거: $OUT (화면은 별도로 열어 판정해야 합니다)"
exit "$FAILED"
