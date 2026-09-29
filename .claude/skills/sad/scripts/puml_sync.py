#!/usr/bin/env python3
"""도면(PlantUML) 렌더 검증과 뷰어 링크 동기화.

  python3 .claude/skills/sad/scripts/puml_sync.py <md> [<md> ...] [--check-only] [--png DIR]

- 문서 안 ```plantuml 블록마다 사내 Kroki(https://plantuml.sumzip.com/plantuml/svg/<enc>)로 렌더해
  HTTP 200 이고 SVG에 "Syntax Error"가 없는지 본다. 하나라도 실패하면 파일을 쓰지 않고 종료 코드 1.
- 블록 바로 뒤(5줄 안) `**[「…」 PlantUML 뷰어로 열기](URL)**` 링크는 **그 블록이 git HEAD와 달라졌을 때만** 새 URL로 바꾼다.
  손대지 않은 도면의 링크는 인코딩이 달라도 그대로 둔다(불필요한 변경 방지).
- --png DIR: 바뀐 블록을 PNG로 받아 둔다(와이어프레임·스윔레인을 눈으로 확인할 때).
"""
import base64, re, subprocess, sys, urllib.error, urllib.request, zlib
from pathlib import Path

BASE = 'https://plantuml.sumzip.com/plantuml/'
LINK = re.compile(r'^(\*\*\[「.*?」 PlantUML 뷰어로 열기\]\()(https://plantuml\.sumzip\.com/plantuml/svg/[^)]+)(\).*)$')


def enc(src):
    return base64.urlsafe_b64encode(zlib.compress(src.encode('utf-8'), 9)).decode('ascii')


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=40) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # 네트워크 오류
        return 0, str(e).encode()


def blocks(text):
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        if lines[i].strip() == '```plantuml':
            j = i + 1
            while j < len(lines) and lines[j].strip() != '```':
                j += 1
            yield i, j, '\n'.join(lines[i + 1:j])
            i = j
        i += 1


def head_blocks(path):
    r = subprocess.run(['git', 'show', f'HEAD:{path}'], capture_output=True, text=True)
    return {b for _, _, b in blocks(r.stdout)} if r.returncode == 0 else set()


def run(path, check_only, png_dir):
    p = Path(path)
    lines = p.read_text(encoding='utf-8').split('\n')
    rel = subprocess.run(['git', 'ls-files', '--full-name', str(p)], capture_output=True, text=True).stdout.strip() or str(p)
    old = head_blocks(rel)
    bad = changed = updated = 0
    for i, j, src in list(blocks('\n'.join(lines))):
        e = enc(src)
        code, body = fetch(BASE + 'svg/' + e)
        ok = code == 200 and b'Syntax Error' not in body
        name = (re.search(r'title (.+)', src) or re.search(r'@startuml\s*(\S+)', src))
        is_new = src not in old
        print(f"{'OK ' if ok else 'BAD'} {code} {'변경' if is_new else '    '} {name.group(1)[:60] if name else '(제목 없음)'}")
        bad += not ok
        if not (ok and is_new):
            continue
        changed += 1
        if png_dir:
            Path(png_dir).mkdir(parents=True, exist_ok=True)
            c2, img = fetch(BASE + 'png/' + e)
            if c2 == 200:
                out = Path(png_dir) / f'{p.stem}_{i}.png'
                out.write_bytes(img)
                print(f'    PNG → {out}')
        for k in range(j + 1, min(j + 6, len(lines))):
            m = LINK.match(lines[k])
            if m:
                if m.group(2) != BASE + 'svg/' + e:
                    lines[k] = m.group(1) + BASE + 'svg/' + e + m.group(3)
                    updated += 1
                break
        else:
            print('    ! 블록 뒤 뷰어 링크 없음 — 링크 줄을 추가한다')
    print(f'{path}: 블록 실패 {bad} · 바뀐 블록 {changed} · 링크 갱신 {updated}')
    if bad:
        return False
    if not check_only and updated:
        p.write_text('\n'.join(lines), encoding='utf-8')
    return True


if __name__ == '__main__':
    args = sys.argv[1:]
    check = '--check-only' in args
    png = args[args.index('--png') + 1] if '--png' in args else None
    files = [a for a in args if not a.startswith('--') and a != png]
    if not files:
        sys.exit(__doc__)
    sys.exit(0 if all([run(f, check, png) for f in files]) else 1)
