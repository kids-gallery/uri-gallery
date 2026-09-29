#!/usr/bin/env python3
"""SAD 변경 탐지·이력 기록.

  python3 .claude/skills/sad/scripts/sad_changes.py scan            # 마지막 이력 시점 이후 변경 → 영향 도면 보고
  python3 .claude/skills/sad/scripts/sad_changes.py diff <path>     # 기준 시점 대비 한 파일의 diff
  python3 .claude/skills/sad/scripts/sad_changes.py record < body.md  # 이력 한 건 추가(머리·상태는 자동)
  python3 .claude/skills/sad/scripts/sad_changes.py init <commit>   # 이력 파일이 없을 때 기준점 SAD-000 만들기

이력 파일: design/SAD_이력.md. 각 기록 끝의 `<!-- sad-state: {...} -->`가 기준점이다
(head = 기록 시점 커밋, dirty = 그때 커밋되지 않았던 파일의 sha1). 저장소 루트에서 실행한다.
"""
import hashlib, json, re, subprocess, sys
from datetime import datetime
from pathlib import Path

ROOT = Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip())
HIST = ROOT / 'design' / 'SAD_이력.md'
STATE = re.compile(r'<!-- sad-state: (\{.*?\}) -->')

# 경로 규칙 → 영향 도면(위에서부터 처음 맞는 규칙). 도면 약어는 references/mapping.md와 같다.
RULES = [
    (r'^design/|^\.specify/', None),                       # 도면·명세 자체 — 영향 대상이 아니라 "이미 고친 도면"
    (r'^(api/tests|web/src/__tests__|web/e2e|serving/tests|db/tests)/', 'TEST'),
    (r'^db/migrations/', 'SD_03 · DDL'),
    (r'^contracts/', '계약(정본 .specify/.../contracts 먼저)'),
    (r'^api/src/modules/(\w+)/', 'MODULE'),
    (r'^api/src/(auth|sweeper|lib|storage|db)/', 'SD_01 · SD_04 · 계약'),
    (r'^api/src/(app|routes|server|config)\.ts$', 'SD_04 · 계약'),
    (r'^web/src/(app|ops)/views/|^web/src/views/', 'SD_02'),
    (r'^web/src/(copy|components|layouts|styles)/', 'SD_02(문구·컴포넌트) · docs/C_화면문구.md'),
    (r'^web/src/router/', 'SD_02 §2 화면 지도'),
    (r'^web/src/(api|stores|composables)/', 'SD_02 · 계약'),
    (r'^serving/model_api/external', 'UC12 · SD_01 P10 · SD_04 · model-api 계약'),
    (r'^serving/(workers|adapters|rules)/', 'SD_04 · stage-job · SD_01 P0'),
    (r'^serving/(model_api|llm_server|common|config|ops)/', 'SD_04 · 계약'),
    (r'^ops/|^\.gitlab-ci|^\.env\.example$', 'SD_04 배치 · plan'),
    (r'^models/manifest', 'SD_04 §9 · REF §2 · SD_03 model_version'),
    (r'^web/|^api/|^serving/', 'SD_04(구성)'),
]
MODULE_UC = {  # app-api 모듈 → UC (UC_00 §3)
    'children': 'UC1', 'artworks': 'UC2·UC3·UC4·UC5', 'gallery': 'UC6', 'files': 'UC6', 'deletion': 'UC7',
    'ops': 'UC8', 'admin': 'UC9', 'captions': 'UC10', 'apiGuide': 'UC11', 'auth': 'UC13·UC14',
    'family': 'UC15', 'mail': 'UC13·UC14·UC15',
}


def git(*a):
    return subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True).stdout


def sha1(p: Path):
    return hashlib.sha1(p.read_bytes()).hexdigest() if p.is_file() else None


def last_state():
    if not HIST.exists():
        return None
    found = STATE.findall(HIST.read_text(encoding='utf-8'))
    return json.loads(found[-1]) if found else None


def working_changes():
    out = {}
    for line in git('status', '--porcelain', '-uall').splitlines():
        st, path = line[:2].strip(), line[3:].strip().strip('"')
        if ' -> ' in path:
            path = path.split(' -> ')[1]
        out[path] = st
    return out


def affected(path):
    for pat, target in RULES:
        m = re.search(pat, path)
        if m:
            if target == 'MODULE':
                mod = m.group(1)
                return f"{MODULE_UC.get(mod, 'UC ?')} · SD_01 · 계약 openapi · SD_04"
            return target
    return '확인 필요'


def scan():
    st = last_state()
    if not st:
        sys.exit('이력 파일에 기준점이 없다 — design/SAD_이력.md를 먼저 만든다(SKILL.md "처음 실행")')
    head = git('rev-parse', '--short', 'HEAD').strip()
    base = st['head']
    commits = git('log', '--reverse', '--format=%h %ad %s', '--date=short', f'{base}..HEAD').splitlines()
    committed = {}
    for line in git('diff', '--name-status', f'{base}..HEAD').splitlines():
        parts = line.split('\t')
        committed[parts[-1]] = parts[0][0]
    work = working_changes()
    rows, same, design_touched = [], [], []
    for path in sorted(set(committed) | set(work)):
        p = ROOT / path
        if st.get('dirty', {}).get(path) and st['dirty'][path] == sha1(p) and path not in committed:
            same.append(path)          # 지난 기록 때와 내용이 같다 — 이미 반영됨
            continue
        tgt = affected(path)
        if tgt is None:
            design_touched.append(path)
            continue
        src = ('커밋' if path in committed else '') + ('+작업트리' if path in work else '')
        rows.append((path, committed.get(path) or work.get(path), src.strip('+'), tgt))
    print(f'# SAD 변경 탐지 — 기준 {base} ({st.get("at", "?")}) → 현재 HEAD {head}' + (' + 작업 트리' if work else ''))
    print(f'\n## 기준 이후 커밋 {len(commits)}건')
    for c in commits:
        print(f'- {c}')
    print(f'\n## 도면 영향 후보 {len(rows)}건 (TEST는 근거 확인용, 도면 대상 아님)\n\n| 파일 | 상태 | 출처 | 영향 도면 |\n|---|:-:|---|---|')
    for r in rows:
        print('| `%s` | %s | %s | %s |' % r)
    if design_touched:
        print(f'\n## 기준 이후 이미 고친 설계·명세 {len(design_touched)}건 — 겹치는 변경은 다시 쓰지 말고 확인만')
        for d in design_touched:
            print(f'- `{d}`')
    if same:
        print(f'\n## 지난 기록 시점과 내용이 같아 건너뜀 {len(same)}건')
        for s in same:
            print(f'- `{s}`')


def diff(path):
    st = last_state()
    base = st['head'] if st else 'HEAD'
    print(git('diff', base, '--', path) or git('diff', '--no-index', '/dev/null', path))


HEADER = '''# SAD 이력 — 구현 → 도면 반영 기록

이 파일은 `.claude/skills/sad`(SAD 스킬)가 쓴다. 기록마다 **기준점**(그 시점 HEAD와 커밋되지 않은 파일의 내용 해시, 끝의 `sad-state` 주석)을 남기고,
다음 실행은 마지막 기준점 이후의 커밋·작업 트리 변경만 보고 도면(`design/`·`.specify/`)에 반영한다. 기록 형식: 구분 · 변경 원천 · (구현 사실 | 반영한 도면·절) 표 · 도면 영향 없음 · 확인 필요 · 검증.
'''


def init(commit):
    if HIST.exists() and last_state():
        sys.exit('이미 기준점이 있다 — record를 쓴다')
    full = git('rev-parse', '--short', commit).strip()
    if not full:
        sys.exit(f'커밋을 찾지 못함: {commit}')
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    HIST.write_text(HEADER + f"\n## SAD-000 · {now}\n\n- 구분: 기준점 설정\n- 기준점: 커밋 `{full}` — 이 시점까지 도면과 구현이 맞는다고 보고 시작한다\n\n"
                    f"<!-- sad-state: {json.dumps({'head': full, 'at': now, 'dirty': {}}, ensure_ascii=False)} -->\n", encoding='utf-8')
    print(f'기준점 SAD-000 → {HIST.relative_to(ROOT)} ({full})')


def record():
    body = sys.stdin.read().strip()
    if not body:
        sys.exit('기록 본문을 stdin으로 준다')
    text = HIST.read_text(encoding='utf-8') if HIST.exists() else HEADER
    n = len(STATE.findall(text))
    head = git('rev-parse', '--short', 'HEAD').strip()
    work = working_changes()
    dirty = {p: sha1(ROOT / p) for p in work}
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    prev = last_state()
    entry = (f"\n## SAD-{n:03d} · {now}\n\n"
             f"- 기준점: HEAD `{head}`" + (f" + 커밋되지 않은 파일 {len(dirty)}개(내용 해시 보관)" if dirty else '') + "\n"
             f"- 이전 기준점: " + (f"`{prev['head']}` ({prev.get('at')})" if prev else '없음(처음)') + "\n\n"
             f"{body}\n\n<!-- sad-state: {json.dumps({'head': head, 'at': now, 'dirty': dirty}, ensure_ascii=False)} -->\n")
    HIST.write_text(text.rstrip('\n') + '\n' + entry, encoding='utf-8')
    print(f'SAD-{n:03d} 기록 → {HIST.relative_to(ROOT)} (기준점 {head}, 미커밋 {len(dirty)}개)')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'scan'
    if cmd in ('diff', 'init') and len(sys.argv) < 3:
        sys.exit(__doc__)
    {'scan': scan, 'record': record, 'diff': lambda: diff(sys.argv[2]), 'init': lambda: init(sys.argv[2])}.get(cmd, lambda: sys.exit(__doc__))()
