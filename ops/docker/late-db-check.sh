#!/bin/sh
# 늦은 DB 재현(마스터플랜 3-5, #140). 비교 쪽의 실패가 기대한 결과이므로 그 종료 코드로 멈추지 않는다.
#   sh ops/docker/late-db-check.sh
# 시작 전 비밀 파일이 있어야 한다(ops/docker/make-secrets.sh). 볼륨을 지우므로 시험 전용 프로젝트 이름으로 돈다.
set -u
cd "$(dirname "$0")/../.."
P=uam-latedb
LATE="-f compose.yaml -f ops/docker/compose.latedb.yaml"
clean() { docker compose -p "$P" $LATE down -v --remove-orphans >/dev/null 2>&1; }

clean
echo "== healthcheck 없음: DB가 ${LATE_DB_SECONDS:-30}초 늦게 뜬다"
docker compose -p "$P" $LATE -f ops/docker/compose.nohealth.yaml up -d --build >/dev/null 2>&1
echo "up 종료 코드 $?"
docker compose -p "$P" $LATE -f ops/docker/compose.nohealth.yaml ps -a --format '{{.Service}} {{.State}} 종료 코드 {{.ExitCode}}' | grep -E '^(db-migrate|app-api) ' || true
docker compose -p "$P" $LATE -f ops/docker/compose.nohealth.yaml logs db-migrate 2>&1 | tail -3
clean

echo "== healthcheck 있음: DB가 ${LATE_DB_SECONDS:-30}초 늦게 뜬다"
start=$(date +%s)
docker compose -p "$P" $LATE up -d --wait --wait-timeout 300 >/dev/null 2>&1
code=$?
echo "up 종료 코드 $code, $(( $(date +%s) - start ))초"
docker compose -p "$P" $LATE ps -a --format '{{.Service}} {{.State}} 종료 코드 {{.ExitCode}}' | grep -E '^(db-migrate|app-api) ' || true
[ "$code" = 0 ] || { clean; exit 1; }

echo "== 실행 중 DB를 끄고 40초 뒤 켠다"
docker compose -p "$P" $LATE stop db >/dev/null
sleep 40
docker compose -p "$P" $LATE start db >/dev/null
docker compose -p "$P" $LATE up -d --wait --wait-timeout 300 >/dev/null 2>&1
docker compose -p "$P" $LATE ps --format '{{.Service}} {{.State}}' | grep -E '^(db|app-api) '
node ops/docker/smoke.mjs
code=$?
clean
exit "$code"
