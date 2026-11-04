#!/bin/sh
# 비밀 파일을 만든다(마스터플랜 3-2, #140). 다시 돌려도 있는 값은 그대로 둔다.
# 파일 비밀은 호스트의 소유자와 권한 그대로 컨테이너에 들어가고, compose의 uid, mode는 파일 비밀에 적용되지 않는다.
# 그래서 파일은 400으로 막고, 컨테이너 사용자(1000)가 읽도록 리눅스에서는 소유자를 1000으로 둔다.
# 맥은 파일 공유 층을 거쳐 소유자를 바꾸지 않아도 읽힌다.
set -eu
cd "$(dirname "$0")/../../secrets"
chmod 700 .
for name in db_password session_secret auth_hmac_secret; do
  [ -e "$name" ] || (umask 077; openssl rand -hex 32 > "$name")
  [ -s "$name" ] || { echo "비밀 파일이 비어 있습니다: secrets/$name" >&2; exit 1; }
  if [ "$(uname)" = Linux ] && [ "$(id -u)" != 1000 ]; then
    sudo chown 1000 "$name"
    sudo chmod 400 "$name"
  else
    chmod 400 "$name"
  fi
done
