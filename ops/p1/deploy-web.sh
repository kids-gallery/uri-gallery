#!/bin/zsh
# p1.sumzip.com 웹 배포(ops/server/DEPLOY.md §7) — main 커밋을 빌드해 .data/p1-web에 바꿔 넣는다.
# 공유 작업 폴더의 web/(커밋 전 작업)는 쓰지 않는다. 프로토타입(design/prototype)은 절대 올리지 않는다.
# D48 ③(SD_02 §17-17): version.json을 함께 올리고, 바꿔 넣은 뒤 공개 주소에서 커밋을 읽어 확인 — 다르면 이전 판으로 되돌리고 실패.
# 사용: ops/p1/deploy-web.sh [커밋, 기본 main]   (확인 주소는 P1_URL, 기본 https://p1.sumzip.com)
set -euo pipefail
ROOT=${0:A:h:h:h}
REF=${1:-main}
URL=${P1_URL:-https://p1.sumzip.com}
COMMIT=$(git -C "$ROOT" rev-parse --short "$REF")
BUILD="$ROOT/.data/p1-build"
rm -rf "$BUILD" && mkdir -p "$BUILD"
git -C "$ROOT" archive "$COMMIT" web contracts | tar -x -C "$BUILD"
cd "$BUILD/web"
npm ci --no-audit --no-fund
npm run build
NEW="$ROOT/.data/p1-web.new"
AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
rm -rf "$NEW" && cp -R dist "$NEW"
echo "$COMMIT $AT" > "$NEW/DEPLOYED_COMMIT"
printf '{"commit":"%s","deployedAt":"%s"}\n' "$COMMIT" "$AT" > "$NEW/version.json"
rm -rf "$ROOT/.data/p1-web.old"
[[ -d "$ROOT/.data/p1-web" ]] && mv "$ROOT/.data/p1-web" "$ROOT/.data/p1-web.old"
mv "$NEW" "$ROOT/.data/p1-web"

# 공개 주소에서 확인(캐시 없음) — 다르면 되돌린다
# 일시 실패에 되돌리지 않게 2초 간격 5번까지 — 마지막 응답의 형식을 실패 메시지에 남긴다
seen=""; ctype=""
for try in 1 2 3 4 5; do
  ctype=$(curl -sS -o "$BUILD/version.seen" -w '%{http_code} %{content_type}' -H 'Cache-Control: no-cache' "$URL/version.json?t=$(date +%s)" 2>/dev/null || echo "연결 안 됨")
  seen=$(sed -n 's/.*"commit":"\([0-9a-f]*\)".*/\1/p' "$BUILD/version.seen" 2>/dev/null || true)
  [[ "$seen" == "$COMMIT" ]] && break
  sleep 2
done
if [[ "$seen" != "$COMMIT" ]]; then
  echo "배포 확인 실패(5번): 공개 주소 커밋 '${seen:-없음}' ≠ $COMMIT · 마지막 응답 $ctype — 이전 판으로 되돌림(nginx /version.json 설정이 읽혔는지 확인)" >&2
  if [[ -d "$ROOT/.data/p1-web.old" ]]; then
    rm -rf "$ROOT/.data/p1-web.bad" && mv "$ROOT/.data/p1-web" "$ROOT/.data/p1-web.bad" && mv "$ROOT/.data/p1-web.old" "$ROOT/.data/p1-web"
  fi
  exit 1
fi
echo "웹 배포: $COMMIT → .data/p1-web (공개 주소 확인됨)"
echo "팀 채널에 붙일 한 줄: 배포됨 $COMMIT $(TZ=Asia/Seoul date '+%m/%d %H:%M') — $URL"
