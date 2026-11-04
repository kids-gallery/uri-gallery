#!/bin/sh
# 늦은 DB 재현(마스터플랜 3-5, #140). DB를 일부러 늦게 띄워 healthcheck가 있을 때와 없을 때를 비교한다.
#   sh ops/docker/late-db-check.sh
# 기대와 다르면 종료 코드 1로 끝난다. 시작 전 비밀 파일이 있어야 한다(ops/docker/make-secrets.sh).
# 실행마다 고유한 프로젝트 이름을 써서 이 시험이 만든 컨테이너와 볼륨만 지운다.
# 입구 망과 포트는 compose에 고정돼 있어, 다른 스택이 떠 있으면 먼저 내려야 한다.
set -u
cd "$(dirname "$0")/../.."
P="uam-latedb-$$-$(date +%s)"
LATE="-f compose.yaml -f ops/docker/compose.latedb.yaml"
clean() { docker compose -p "$P" $LATE down -v --remove-orphans >/dev/null 2>&1; }
trap clean EXIT
fail() { echo "기대와 다름: $1" >&2; docker compose -p "$P" $LATE ps -a >&2; exit 1; }
field() { docker compose -p "$P" $LATE ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}' | awk -v s="$1" '$1==s{print $2, $3}'; }

echo "== healthcheck 없음: DB가 ${LATE_DB_SECONDS:-30}초 늦게 뜬다"
docker compose -p "$P" $LATE -f ops/docker/compose.nohealth.yaml up -d --build >/dev/null 2>&1
code=$?
migrate=$(field db-migrate)
api=$(field app-api)
echo "up 종료 코드 $code, db-migrate [$migrate], app-api [$api]"
[ "$code" != 0 ] || fail "healthcheck 없이도 up이 성공했다"
[ "$migrate" = "exited 1" ] || fail "db-migrate가 실패로 끝나지 않았다"
[ "$api" = "created 0" ] || fail "app-api가 시작하지 않은 상태가 아니다"
clean

echo "== healthcheck 있음: DB가 ${LATE_DB_SECONDS:-30}초 늦게 뜬다"
start=$(date +%s)
docker compose -p "$P" $LATE up -d --wait --wait-timeout 300 >/dev/null 2>&1
code=$?
migrate=$(field db-migrate)
api=$(field app-api)
echo "up 종료 코드 $code, $(( $(date +%s) - start ))초, db-migrate [$migrate], app-api [$api]"
[ "$code" = 0 ] || fail "up이 실패했다"
[ "$migrate" = "exited 0" ] || fail "db-migrate가 성공으로 끝나지 않았다"
[ "$api" = "running 0" ] || fail "app-api가 실행 중이 아니다"

echo "== 실행 중 DB를 끄고 40초 뒤 켠다"
docker compose -p "$P" $LATE stop db >/dev/null 2>&1
sleep 40
docker compose -p "$P" $LATE start db >/dev/null 2>&1
# up을 다시 부르면 죽은 앱도 살려 버린다. DB만 기다려 앱이 혼자 회복하는지 본다
health=""
for _ in $(seq 60); do
  health=$(docker compose -p "$P" $LATE ps db --format '{{.Health}}')
  [ "$health" = healthy ] && break
  sleep 5
done
[ "$health" = healthy ] || fail "DB가 다시 healthy가 되지 않았다"
restarts=$(docker inspect "$(docker compose -p "$P" $LATE ps -q app-api)" --format '{{.RestartCount}}')
echo "app-api 재시작 횟수 $restarts"
[ "$restarts" = 0 ] || fail "app-api가 재시작했다"
node ops/docker/smoke.mjs || fail "DB 복구 뒤 한 바퀴가 돌지 않았다"
echo "늦은 DB 시험 통과"
