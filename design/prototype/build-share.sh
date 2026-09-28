#!/bin/sh
# 원본(아티팩트용, 문서 머리 없음)에서 공유용 단독 페이지 share/index.html 을 만든다.
# 원본을 고친 뒤 이 스크립트만 다시 실행한다. share/index.html 은 직접 고치지 않는다.
set -e
cd "$(dirname "$0")"
SRC=우리아이미술관_프로토타입.html
OUT=share/index.html
mkdir -p share
{
  printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
  sed -n '1,/^<\/style>$/p' "$SRC"
  printf '</head>\n<body>\n'
  sed -n '/^<\/style>$/,$p' "$SRC" | tail -n +2
  printf '</body>\n</html>\n'
} > "$OUT"
echo "built $OUT from $SRC"
