#!/usr/bin/env python3
"""이슈 목록(이슈설계_컨테이너협업.md 4절)을 이슈 양식(.github/ISSUE_TEMPLATE/작업.md) 칸 순서대로 본문으로 만든다.

기본은 점검만 한다. --show 로 하나를 미리 보고, --out 으로 전부 파일로 저장하고, --apply 로 실제로 올린다.
표준 라이브러리만 쓴다. --apply 에만 gh CLI(로그인 상태)가 필요하다.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs/공통/이슈설계_컨테이너협업.md"
TEMPLATE = ROOT / ".github/ISSUE_TEMPLATE/작업.md"
PLAN = ROOT / "design/PLAN_3인디벨롭_컨테이너협업_우리아이미술관.md"

COMMON = "공통"   # 셋이 함께 맡는 이슈. 리뷰어는 작성자가 아닌 사람
FIELDS = ["담당", "종류", "선행", "근거", "대상 경로", "이루려는 것", "해야 할 일", "끝나는 조건"]
TYPE = {"feat": "Feature", "fix": "Bug", "docs": "Task", "chore": "Task", "test": "Task"}   # 종류(커밋 종류) → 이슈 타입
MARK = "<!-- issue-id: {} -->"

HEAD_RE = re.compile(r"^#### (I-\d{2}) \[([^\]]+)\] (.+)$", re.M)
DAY_RE = re.compile(r"^(\d)일차·(\d{2}-\d{2}) (\S)$")
ID_RE = re.compile(r"I-\d{2}")


def template_sections() -> list[str]:
    text = TEMPLATE.read_text(encoding="utf-8")
    body = text.split("---", 2)[2] if text.startswith("---") else text
    return re.findall(r"^## (.+?)\s*$", body, re.M)


def roles() -> dict[str, dict[str, str]]:
    """마스터플랜 4절 역할표에서 이름 → 아이디·영역(역할 칸)·리뷰어."""
    sec = PLAN.read_text(encoding="utf-8").split("## 4. 역할 배정", 1)[1].split("\n## ", 1)[0]
    out = {}
    for line in sec.splitlines():
        if m := re.match(r"\| ([^|(]+)\(`([^`]+)`", line):
            cells = [c.strip() for c in line.strip(" |").split("|")]
            out[m[1].strip()] = {"login": m[2], "area": cells[2].split(" +")[0], "reviewer": cells[-1]}
    return out


def labels(it: dict) -> list[str]:
    area = roles().get(it["담당"], {}).get("area", COMMON)
    return [f"영역: {area}", f"종류: {it['종류']}"]


def parse_day(label: str) -> tuple[int, str] | None:
    if label == "준비":
        return 0, label
    m = DAY_RE.match(label)
    if not m:
        return None
    return int(m.group(1)), f"{m.group(1)}일차 {m.group(2)}({m.group(3)})"


def parse_doc() -> list[dict]:
    text = DOC.read_text(encoding="utf-8")
    heads = list(HEAD_RE.finditer(text))
    issues = []
    for i, h in enumerate(heads):
        block = text[h.end(): heads[i + 1].start() if i + 1 < len(heads) else len(text)]
        block = block.split("\n### ")[0].split("\n## ")[0]   # 다음 날·다음 절 머리말 앞까지
        it = {"id": h.group(1), "label": h.group(2), "title": h.group(3).strip(), "summary": "", "todo": []}
        cur = None
        for line in block.splitlines():
            if line.startswith("> "):
                it["summary"] = line[2:].strip()
            elif line.startswith("  - [ ] ") and cur == "해야 할 일":
                it["todo"].append(line[8:].strip())
            elif line.startswith("- "):
                key, _, val = line[2:].partition(":")
                cur = key.strip()
                if cur in FIELDS:
                    it[cur] = val.strip()
        it["deps"] = [] if it.get("선행", "") in ("", "없음") else ID_RE.findall(it["선행"])
        issues.append(it)
    return issues


def check(issues: list[dict]) -> tuple[list[str], list[str]]:
    errs, warns = [], []
    ids = [it["id"] for it in issues]
    byid = {it["id"]: it for it in issues}
    if len(set(ids)) != len(ids):
        errs.append("I-번호가 겹친다")
    if ids != [f"I-{n:02d}" for n in range(1, len(ids) + 1)]:
        errs.append(f"I-번호가 1부터 차례가 아니다: {ids}")
    sections = template_sections()
    people = roles()
    for it in issues:
        tag = it["id"]
        day = parse_day(it["label"])
        if day is None:
            errs.append(f"{tag} 제목의 날짜 칸 [{it['label']}]이 '준비' 또는 'N일차·MM-DD 요일' 형식이 아니다")
        it["day"] = day
        for f in FIELDS:
            if f != "해야 할 일" and not it.get(f):
                errs.append(f"{tag} '{f}' 칸이 비었다")
        if not it["summary"]:
            errs.append(f"{tag} 한 줄 설명(> 줄)이 없다")
        if not it["todo"]:
            errs.append(f"{tag} 해야 할 일이 없다")
        if it.get("담당") not in [*people, COMMON]:
            errs.append(f"{tag} 담당 '{it.get('담당')}'이 역할표에 없다")
        if it.get("종류") not in TYPE:
            errs.append(f"{tag} 종류 '{it.get('종류')}'가 {list(TYPE)} 가운데 하나가 아니다")
        if not re.search(r"\d", it.get("근거", "")):
            errs.append(f"{tag} 근거에 마스터플랜 절 번호가 없다")
        for d in it["deps"]:
            if d not in byid:
                errs.append(f"{tag} 선행 {d}가 목록에 없다")
            elif d >= tag:
                errs.append(f"{tag} 선행 {d}가 자기보다 뒤 번호다")
        parts = body_parts(it)
        if list(parts) != sections:
            errs.append(f"{tag} 스크립트가 채우는 칸 {list(parts)}이 양식 칸 {sections}과 다르다. 양식이나 body_parts를 맞춘다")
        elif any(not v.strip() for v in parts.values()):
            errs.append(f"{tag} 빈 칸이 있다: {[k for k, v in parts.items() if not v.strip()]}")
    for it in issues:   # 날짜 순서: 선행은 같은 날이거나 앞날이어야 한다
        for d in it["deps"]:
            dep = byid.get(d)
            if not dep or not dep.get("day") or not it.get("day"):
                continue
            if dep["day"][0] > it["day"][0]:
                errs.append(f"{it['id']}({it['label']})의 선행 {d}({dep['label']})가 더 늦은 날이다")
            # 같은 날 다른 사람의 일이 끝나길 기다리는 곳만 알린다(그날 끝 공통 확인과 자기 순서는 뺀다)
            elif (dep["day"][0] == it["day"][0] and it.get("담당") != "공통"
                  and dep.get("담당") not in ("공통", it.get("담당"))):
                warns.append(f"{it['id']}({it['담당']})는 같은 날 {d}({dep['담당']})가 끝나야 시작한다({it['label']})")
    return errs, warns


def body_parts(it: dict, numbers: dict[str, int] | None = None) -> dict[str, str]:
    """양식 칸 이름 → 내용. 칸 순서는 양식(작업.md)과 같아야 한다."""
    def ref(text: str) -> str:
        return ID_RE.sub(lambda m: f"#{numbers[m.group(0)]}" if numbers and m.group(0) in numbers else m.group(0), text)

    owner = it.get("담당", "")
    day = it.get("day") or parse_day(it["label"]) or (None, it["label"])
    parts = {
        "한 줄 설명": ref(it["summary"]),
        "이루려는 것": ref(it.get("이루려는 것", "")),
        "근거": ref(it.get("근거", "")),
        "대상 경로": ref(it.get("대상 경로", "")),
        "해야 할 일": "\n".join(f"- [ ] {ref(t)}" for t in it["todo"]),
        "끝나는 조건": ref(it.get("끝나는 조건", "")),
        "순서와 담당": "\n".join([
            f"- 날짜: {day[1]}",
            f"- 담당: {owner}",
            f"- 선행: {ref(', '.join(it['deps'])) if it['deps'] else '없음'}",
            f"- 리뷰어: {roles().get(owner, {}).get('reviewer', '작성자가 아닌 사람')}",
        ]),
    }
    return parts


def build_body(it: dict, numbers: dict[str, int] | None = None) -> str:
    out = [MARK.format(it["id"])]
    for sec, text in body_parts(it, numbers).items():
        out += ["", f"## {sec}", text]
    return "\n".join(out) + "\n"


def full_title(it: dict) -> str:
    return f"[{it['label']} · {it['담당']}] {it['title']}"


def summary_table(issues: list[dict]) -> str:
    days = sorted({it["day"][0] for it in issues if it.get("day")})
    names = [*roles(), COMMON]
    head = "| 담당 | " + " | ".join("준비" if d == 0 else f"{d}일차" for d in days) + " | 합계 |"
    rows = [head, "|" + "---|" * (len(days) + 2)]
    for n in names:
        cnt = [sum(1 for it in issues if it.get("담당") == n and it.get("day") and it["day"][0] == d) for d in days]
        rows.append(f"| {n} | " + " | ".join(str(c) for c in cnt) + f" | {sum(cnt)} |")
    return "\n".join(rows)


def gh(*args: str, stdin: str | None = None) -> str:
    return subprocess.run(["gh", *args], input=stdin, text=True, capture_output=True, check=True).stdout


def apply(issues: list[dict], repo: str, project: str | None = None) -> None:
    listed = json.loads(gh("issue", "list", "-R", repo, "--state", "all", "--limit", "500", "--json", "number,body"))
    people = roles()
    numbers = {}
    for row in listed:
        m = re.search(r"<!-- issue-id: (I-\d{2}) -->", row.get("body") or "")
        if m:
            numbers[m.group(1)] = row["number"]
    have = {m["title"] for m in json.loads(gh("api", f"repos/{repo}/milestones?state=all&per_page=100"))}
    have_labels = {x["name"] for x in json.loads(gh("label", "list", "-R", repo, "--limit", "200", "--json", "name"))}
    for name in dict.fromkeys(l for it in issues for l in labels(it)):   # 영역·종류 라벨
        if name not in have_labels:
            gh("label", "create", name, "-R", repo)
    for day in dict.fromkeys(it["day"][1] for it in issues):   # 날짜별 마일스톤(제목의 날짜에서 만든다)
        if day not in have:
            gh("api", f"repos/{repo}/milestones", "-f", f"title={day}")
    for it in issues:   # 1차: 없는 것만 올린다
        if it["id"] in numbers:
            print(f"{it['id']} 이미 있음 #{numbers[it['id']]}")
            continue
        owner = it["담당"]
        who = [p["login"] for p in people.values()] if owner == COMMON else [people[owner]["login"]]
        url = gh("issue", "create", "-R", repo, "--title", full_title(it), "--body-file", "-",
                 *sum((["--assignee", w] for w in who), []), stdin=build_body(it)).strip()
        numbers[it["id"]] = int(url.rstrip("/").rsplit("/", 1)[1])
        print(f"{it['id']} 올림 #{numbers[it['id']]} {full_title(it)}")
    for it in issues:   # 2차: 선행 I-번호를 실제 #번호로 바꾼다
        gh("issue", "edit", str(numbers[it["id"]]), "-R", repo, "--title", full_title(it), "--body-file", "-",
           "--milestone", it["day"][1], "--add-label", ",".join(labels(it)), "--type", TYPE[it["종류"]],
           *(["--add-project", project] if project else []), stdin=build_body(it, numbers))
    print("선행 번호를 실제 이슈 번호로 바꿨다.")
    print("\n| I-번호 | GitHub |\n|---|---|\n" + "\n".join(f"| {k} | #{v} |" for k, v in sorted(numbers.items())))


def main() -> int:
    ap = argparse.ArgumentParser(description="이슈 목록 점검·미리 보기·올리기")
    ap.add_argument("--show", metavar="I-번호", help="이슈 하나의 제목과 본문을 보인다")
    ap.add_argument("--out", metavar="폴더", help="모든 본문을 파일로 저장한다")
    ap.add_argument("--apply", action="store_true", help="실제로 올린다(--repo 필요)")
    ap.add_argument("--repo", help="올릴 저장소(예: kids-gallery/uri-gallery)")
    ap.add_argument("--project", help="이슈를 넣을 프로젝트 보드 제목(gh에 project 권한 필요)")
    a = ap.parse_args()

    issues = parse_doc()
    errs, warns = check(issues)
    print(f"이슈 {len(issues)}개 · 양식 칸 {len(template_sections())}개({' · '.join(template_sections())})")
    print(summary_table(issues))
    for w in warns:
        print("주의:", w)
    for e in errs:
        print("오류:", e)
    print(f"점검 결과: 오류 {len(errs)}건, 주의 {len(warns)}건")
    if errs:
        return 1

    if a.show:
        it = next((x for x in issues if x["id"] == a.show), None)
        if not it:
            print(f"{a.show}가 없다")
            return 1
        print(f"\n제목: {full_title(it)}\n담당자 지정: {it['담당']}\n\n{build_body(it)}")
    if a.out:
        out = Path(a.out)
        out.mkdir(parents=True, exist_ok=True)
        for it in issues:
            (out / f"{it['id']}.md").write_text(f"# {full_title(it)}\n\n{build_body(it)}", encoding="utf-8")
        print(f"본문 {len(issues)}개를 {out}에 저장했다.")
    if a.apply:
        if not a.repo:
            print("--apply에는 --repo가 필요하다")
            return 1
        apply(issues, a.repo, a.project)
    return 0


if __name__ == "__main__":
    sys.exit(main())
