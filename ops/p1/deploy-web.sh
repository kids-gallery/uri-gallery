#!/bin/zsh
# p1.sumzip.com 웹 배포(ops/DEPLOY.md §7) — main 커밋을 빌드해 .data/p1-web에 바꿔 넣는다.
# 공유 작업 폴더의 web/(커밋 전 작업)는 쓰지 않는다. 프로토타입(design/prototype)은 절대 올리지 않는다.
# 사용: ops/p1/deploy-web.sh [커밋, 기본 main]
set -euo pipefail
ROOT=${0:A:h:h:h}
REF=${1:-main}
COMMIT=$(git -C "$ROOT" rev-parse --short "$REF")
BUILD="$ROOT/.data/p1-build"
rm -rf "$BUILD" && mkdir -p "$BUILD"
git -C "$ROOT" archive "$COMMIT" web contracts | tar -x -C "$BUILD"
cd "$BUILD/web"
npm ci --no-audit --no-fund
npm run build
NEW="$ROOT/.data/p1-web.new"
rm -rf "$NEW" && cp -R dist "$NEW"
echo "$COMMIT $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$NEW/DEPLOYED_COMMIT"
rm -rf "$ROOT/.data/p1-web.old"
[[ -d "$ROOT/.data/p1-web" ]] && mv "$ROOT/.data/p1-web" "$ROOT/.data/p1-web.old"
mv "$NEW" "$ROOT/.data/p1-web"
echo "웹 배포: $COMMIT → .data/p1-web"
