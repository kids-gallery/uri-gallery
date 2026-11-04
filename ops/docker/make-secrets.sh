#!/bin/sh
# 비밀 파일을 만든다(마스터플랜 3-2, #140). 다시 돌려도 있는 값은 그대로 둔다.
# 파일 비밀은 호스트 권한 그대로 컨테이너에 들어간다. 서버 계정 번호가 컨테이너 사용자(1000)와 달라도 읽도록 파일은 444,
# 대신 다른 계정이 들어오지 못하게 폴더를 700으로 둔다.
set -eu
cd "$(dirname "$0")/../../secrets"
for name in db_password session_secret auth_hmac_secret; do
  [ -e "$name" ] || openssl rand -hex 32 > "$name"
  [ -s "$name" ] || { echo "비밀 파일이 비어 있습니다: secrets/$name" >&2; exit 1; }
  chmod 444 "$name"
done
chmod 700 .
