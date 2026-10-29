#!/usr/bin/env python3
"""리뷰봇(계획서 4-1) — PR을 규칙 검사(rules.json)와 AI 비판 검토로 판정한다.

- PR의 코드는 실행하지 않는다. 바뀐 내용은 GitHub API로만 읽는다.
- 판정 내용은 rules.json에 있다. 이 파일은 그 표를 적용하고 결과를 PR에 남기기만 한다.
- 막음이 있으면 변경 요청 리뷰 + `리뷰봇-막음` 라벨 + PR 닫기 + 종료 코드 1(검사 실패).
  (워크플로 토큰은 PR을 초안으로 바꿀 수 없어서 닫는다. 2026-10-29 실행에서 "Resource not accessible by integration" 확인)
- 봇은 승인하지 않는다. 통과는 "사람 리뷰 차례"라는 뜻이다.
표준 라이브러리만 쓴다(Actions 기본 Python에서 바로 돈다).
"""
from __future__ import annotations

import fnmatch
import json
import os
import posixpath
import re
import sys
import urllib.error
import urllib.request
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
MARK = "<!-- review-bot -->"
BOT = "github-actions[bot]"


def load_rules(path: str = os.path.join(HERE, "rules.json")) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------- 순수 판정(시험 대상) ----------

def match_any(path: str, globs: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, g) for g in globs)


def sections(body: str) -> dict[str, str]:
    """`## 제목` 아래 글을 제목별로 나눈다. 주석(<!-- -->)은 뺀다."""
    body = re.sub(r"<!--.*?-->", "", body or "", flags=re.S)
    out: dict[str, str] = {}
    cur = None
    for line in body.splitlines():
        m = re.match(r"^\s*#{2,3}\s+(.+?)\s*$", line)
        if m:
            cur = m.group(1)
            out[cur] = ""
        elif cur is not None:
            out[cur] += line + "\n"
    return out


def filled(text: str, rules: dict) -> str:
    """자리표시 줄을 뺀 실제 내용."""
    keep = [ln for ln in (text or "").splitlines()
            if not any(re.match(p, ln) for p in rules["placeholder_lines"])]
    return "\n".join(keep).strip()


def added_lines(patch: str | None) -> list[str]:
    return [ln[1:] for ln in (patch or "").splitlines() if ln.startswith("+") and not ln.startswith("+++")]


def owners_of(path: str, codeowners: str) -> list[str]:
    """CODEOWNERS에서 마지막으로 맞는 줄의 주인(GitHub 규칙과 같다)."""
    found: list[str] = []
    for raw in (codeowners or "").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        pat, *who = line.split()
        p = pat.lstrip("/")
        if pat == "*":
            ok = True
        elif p.endswith("/"):
            ok = path.startswith(p) or ("/" not in pat.rstrip("/") and f"/{p}" in f"/{path}")
        else:
            ok = fnmatch.fnmatchcase(path, p) or fnmatch.fnmatchcase(posixpath.basename(path), p)
        if ok:
            found = [w.lstrip("@").lower() for w in who]
    return found


def docker_base_problems(text: str) -> list[str]:
    """기반 이미지 판 번호가 없거나 latest인 FROM 줄. 앞 단계 이름(AS x)을 가리키면 괜찮다."""
    stages: set[str] = set()
    bad: list[str] = []
    for ln in text.splitlines():
        m = re.match(r"^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?", ln, re.I)
        if not m:
            continue
        img, alias = m.group(1), m.group(2)
        if img.lower() not in stages and img != "scratch":
            name = img.split("@", 1)[0]
            tag = name.rsplit(":", 1)[1] if ":" in name.rsplit("/", 1)[-1] else None
            if "@sha256:" not in img and (tag is None or tag == "latest"):
                bad.append(ln.strip())
        if alias:
            stages.add(alias.lower())
    return bad


def evaluate(ctx: dict, rules: dict) -> list[dict]:
    """규칙 검사. 결과: [{rule, level('block'|'warn'), detail}]"""
    out: list[dict] = []

    def add(rule: str, detail: str, level: str = "block"):
        out.append({"rule": rule, "level": level, "detail": detail})

    secs = sections(ctx["body"])
    S = rules["sections"]
    files = ctx["files"]
    names = [f["filename"] for f in files]

    # 이슈 연결 · 양식 · 확인 근거
    if not re.search(rules["issue_link"], filled(secs.get(S["issue"], ""), rules) or ""):
        add("issue_link", "'관련 이슈' 칸에 연결된 이슈 번호가 없다")
    empty = [t for t in S["required"] if not filled(secs.get(t, ""), rules)]
    if empty:
        add("template", "비어 있는 칸: " + ", ".join(empty))
    ev = filled(secs.get(S["evidence"], ""), rules)
    if ev and not re.search(rules["evidence_pattern"], ev):
        add("evidence", "'확인한 것'에 명령이나 숫자가 없다")

    # 가지 이름 · 커밋 메시지
    if not re.match(rules["branch_pattern"], ctx["branch"]):
        add("branch", f"`{ctx['branch']}`")
    bad_commits = [m.splitlines()[0] for m in ctx["commits"]
                   if not re.match(rules["commit_skip_pattern"], m)
                   and not re.match(rules["commit_pattern"], m.splitlines()[0] if m else "")]
    if bad_commits:
        add("commit", "; ".join(f"`{c[:60]}`" for c in bad_commits[:5]))

    # 비밀 값 · 금지 파일 · 큰 파일
    for f in files:
        if f.get("status") == "removed":
            continue
        for i, ln in enumerate(added_lines(f.get("patch"))):
            if any(re.search(p, ln) for p in rules["secret_patterns"]):
                add("secret", f"`{f['filename']}` 추가한 줄 {i + 1}번째")
                break
        n = f["filename"]
        if match_any(n, rules["forbidden_globs"]) and not match_any(n, rules["forbidden_except"]):
            add("forbidden", f"`{n}`")
        size = ctx["sizes"].get(n, 0)
        if size > rules["max_file_bytes"]:
            add("big_file", f"`{n}` {size / 1048576:.1f}MB")

    # 설계서 먼저
    alive = [f["filename"] for f in files if f.get("status") != "removed"]
    code = [n for n in names if match_any(n, rules["code_globs"])]
    design = [n for n in names if match_any(n, rules["design_globs"])]
    ref = filled(secs.get(S["design"], ""), rules)
    if code and not design and not re.search(rules["design_ref_pattern"], ref):
        add("design_first", "바꾼 코드: " + ", ".join(f"`{c}`" for c in code[:5]))

    # 범위 밖
    so = rules["scope_out"]
    hits = [n for n in alive if match_any(n, so["paths"])]
    for f in files:
        if match_any(f["filename"], so["content_globs"]):
            for ln in added_lines(f.get("patch")):
                if any(re.search(p, ln) for p in so["content"]):
                    hits.append(f"{f['filename']}: `{ln.strip()[:60]}`")
                    break
    if hits:
        add("scope_out", "; ".join(hits[:5]))

    # 크기
    total = sum(f.get("additions", 0) + f.get("deletions", 0) for f in files
                if not match_any(f["filename"], rules["size"]["ignore_globs"]))
    if total > rules["size"]["block"]:
        add("size", f"바뀐 줄 {total}줄(한도 {rules['size']['block']})")
    elif total > rules["size"]["warn"]:
        add("size", f"바뀐 줄 {total}줄(권장 {rules['size']['warn']} 이하)", "warn")

    # Dockerfile 기본
    for n in alive:
        if not match_any(n, rules["dockerfile_globs"]):
            continue
        for ln in docker_base_problems(ctx["file_text"].get(n, "")):
            add("docker_tag", f"`{n}`: `{ln}`")
        d = posixpath.dirname(n)
        cands = [posixpath.join(d, x) if d else x for x in rules["dockerignore_names"]] + rules["dockerignore_names"]
        if not any(c in ctx["tree"] for c in cands):
            add("dockerignore", f"`{n}`")

    # 리뷰봇 자체 수정
    bot = [n for n in names if match_any(n, rules["bot_globs"])]
    if bot:
        add("bot_self", ", ".join(f"`{b}`" for b in bot[:5]))

    # 남의 폴더(경고)
    who = ctx["author"].lower()
    foreign = sorted({n for n in names if (o := owners_of(n, ctx["codeowners"])) and who not in o})
    if foreign:
        add("owner", ", ".join(f"`{n}`" for n in foreign[:5]), "warn")

    return out


def apply_override(findings: list[dict], ctx: dict, rules: dict) -> list[dict]:
    """작성자가 아닌 사람이 예외 라벨을 붙이고 본문에 이유를 적었으면 예외 가능 규칙을 경고로 바꾼다."""
    if not (ctx["override_by_other"] and rules["override_reason"] in (ctx["body"] or "")):
        return findings
    return [dict(f, level="warn", detail=f["detail"] + " (예외 승인)")
            if f["level"] == "block" and f["rule"] in rules["overridable"] else f for f in findings]


def parse_ai(text: str, names: list[str], rules: dict) -> tuple[str, list[dict]]:
    """AI 답(JSON)을 검사한다. 막음은 PR에 실제로 있는 파일을 가리킬 때만 막음으로 둔다."""
    m = re.search(r"\{.*\}", text or "", re.S)  # 코드 블록(```json)으로 감싸 와도 읽는다
    data = json.loads(m.group(0) if m else text)
    if not isinstance(data, dict):
        raise ValueError("JSON 객체가 아니다")
    issues = []
    for it in (data.get("issues") or [])[: rules["ai"]["max_issues"]]:
        sev = str(it.get("severity", "참고"))
        sev = sev if sev in ("막음", "고침 권함", "참고") else "참고"
        f = str(it.get("file", "")).strip().lstrip("/")
        if sev == "막음" and f not in names:
            sev = "고침 권함"
        issues.append({"severity": sev, "file": f, "problem": str(it.get("problem", ""))[:400],
                       "fix": str(it.get("fix", ""))[:400]})
    return str(data.get("summary", ""))[:600], issues


# ---------- GitHub · AI 호출 ----------

class GH:
    def __init__(self, repo: str, token: str, api: str = "https://api.github.com"):
        self.repo, self.token, self.api = repo, token, api

    def call(self, method: str, path: str, body=None, raw: bool = False) -> Any:
        url = path if path.startswith("http") else f"{self.api}{path}"
        req = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode())
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Accept", "application/vnd.github.raw" if raw else "application/vnd.github+json")
        req.add_header("X-GitHub-Api-Version", "2022-11-28")
        if body is not None:
            req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            return data.decode() if raw else (json.loads(data) if data else None)

    def all(self, path: str) -> list:
        out: list = []
        page = 1
        while True:
            sep = "&" if "?" in path else "?"
            chunk = self.call("GET", f"{path}{sep}per_page=100&page={page}")
            out += chunk
            if len(chunk) < 100:
                return out
            page += 1


def ai_review(ctx: dict, rules: dict) -> tuple[bool, str, list[dict]]:
    """OpenAI 호환 대화 API로 비판 검토. 주소·모델·키가 모두 있어야 켜진다(저장소 변수·비밀)."""
    ai = rules["ai"]
    endpoint, model, key = (os.environ.get(k, "").strip() for k in ("REVIEW_AI_ENDPOINT", "REVIEW_AI_MODEL", "REVIEW_AI_KEY"))
    if not (endpoint and model and key):
        return False, "AI 검토가 꺼져 있다(저장소에 AI 주소·모델·키가 설정되지 않음). 규칙 검사로만 판정했다.", []
    diff = ""
    for f in ctx["files"]:
        diff += f"\n--- {f['filename']} ({f.get('status')})\n{f.get('patch') or '(내용 없음: 바이너리이거나 너무 큼)'}\n"
    cut = len(diff) > ai["max_diff_chars"]
    diff = diff[: ai["max_diff_chars"]]
    system = (
        "너는 이 팀 저장소의 엄격한 코드 리뷰어다. 칭찬하지 말고 문제만 찾는다. 기준은 아래 '작업 범위와 원칙'이다.\n"
        "보는 것: ① 이번 작업 범위에 필요한 변경인가(범위 밖이면 막음) ② Dockerfile·compose 원칙 위반 "
        "③ 실제 버그·보안 문제 ④ PR 본문의 '확인한 것'이 바뀐 내용을 실제로 확인하는가 ⑤ 설계서와 구현이 어긋나는가.\n"
        "막음은 병합하면 서비스가 깨지거나, 비밀이 새거나, 범위 밖이거나, 원칙을 분명히 어긴 경우에만 쓴다. "
        "확실하지 않으면 '고침 권함'이나 '참고'로 낮춘다. 보이지 않는 코드를 추측해 지적하지 않는다. 문제가 없으면 issues를 비운다.\n"
        "한국어로 짧게 쓴다. JSON만 답한다: "
        '{"summary": "한두 문장", "issues": [{"file": "경로", "severity": "막음|고침 권함|참고", "problem": "무엇이 왜 문제인가", "fix": "어떻게 고치나"}]}\n\n'
        "작업 범위와 원칙: " + ai["context"]
    )
    user = (f"PR 제목: {ctx['title']}\n작성자: {ctx['author']}\n가지: {ctx['branch']}\n\nPR 본문:\n{ctx['body']}\n\n"
            "커밋:\n" + "\n".join(ctx["commits"]) + f"\n\n바뀐 내용{'(앞부분만)' if cut else ''}:\n{diff}")
    body = {"model": model, "temperature": 0.2,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(endpoint, data=json.dumps(body).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    raw = b""
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            raw = r.read()
            text = json.loads(raw)["choices"][0]["message"]["content"]
        summary, issues = parse_ai(text, [f["filename"] for f in ctx["files"]], rules)
        return True, summary + (" (바뀐 내용이 길어 앞부분만 봤다)" if cut else ""), issues
    except (urllib.error.URLError, KeyError, IndexError, ValueError, TimeoutError) as e:
        why = f"HTTP {e.code}" if isinstance(e, urllib.error.HTTPError) else type(e).__name__
        if isinstance(e, urllib.error.HTTPError):
            raw = e.read()
        print(f"[AI 검토 실패] {why}: {raw[:300]!r}", file=sys.stderr)  # 원인은 실행 기록에만 남긴다
        return False, f"AI 검토를 하지 못했다({why}). 규칙 검사로만 판정했다.", []


# ---------- 결과 쓰기 ----------

def render(verdict_block: bool, findings: list[dict], ai_ok: bool, ai_summary: str, ai_issues: list[dict],
           sha: str, rules: dict, closed: bool = True) -> str:
    msg = rules["messages"]
    blocks = [f for f in findings if f["level"] == "block"]
    warns = [f for f in findings if f["level"] == "warn"]
    ai_blocks = [i for i in ai_issues if i["severity"] == "막음"]
    n = len(blocks) + len(ai_blocks)
    lines = [MARK, f"## 리뷰봇 판정: {'막음 ' + str(n) + '건' if verdict_block else '통과'}", "",
             f"검사한 커밋 `{sha[:7]}` · AI 검토 {'함' if ai_ok else '못 함'}", ""]
    if verdict_block:
        lines += ["고치기 전에는 병합할 수 없다. " + ("PR을 닫았다." if closed else "PR을 닫지 못했다. 이 검사가 실패로 남아 있는 동안 병합하지 않는다.")
                  + " 본문을 고치면 바로 다시 검사해, 통과하면 다시 연다. 코드를 고쳤으면 커밋을 올린 뒤 'Reopen pull request'를 누른다.", ""]
    else:
        lines += ["규칙 검사를 통과했다. 이제 사람 리뷰 차례다. 봇은 승인하지 않는다.", ""]

    def table(title, rows):
        if rows:
            lines.extend([f"### {title}", "", "| 규칙 | 무엇이 문제인가 | 고치는 법 |", "|---|---|---|"])
            for f in rows:
                t, fix = msg.get(f["rule"], [f["rule"], ""])
                lines.append(f"| {t} | {f['detail']} | {fix} |")
            lines.append("")

    table("고쳐야 병합할 수 있는 것", blocks)
    table("경고", warns)
    lines += ["### AI 비판 검토", "", ai_summary or "(요약 없음)", ""]
    if ai_issues:
        lines += ["| 심각도 | 파일 | 문제 | 고칠 방법 |", "|---|---|---|---|"]
        for i in ai_issues:
            cell = lambda s: s.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {i['severity']} | `{cell(i['file'])}` | {cell(i['problem'])} | {cell(i['fix'])} |")
        lines.append("")
    lines += ["---", f"판정 기준: 계획서 4-1, `.github/review-bot/rules.json`. 틀린 판정이면 댓글로 근거를 남기고 팀장과 정한다."]
    return "\n".join(lines)


def main() -> int:
    rules = load_rules()
    repo, token, num = os.environ["GITHUB_REPOSITORY"], os.environ["GH_TOKEN"], int(os.environ["PR_NUMBER"])
    gh = GH(repo, token, os.environ.get("GITHUB_API_URL", "https://api.github.com"))
    R = f"/repos/{repo}"
    pr = gh.call("GET", f"{R}/pulls/{num}")
    head, base = pr["head"]["sha"], pr["base"]["sha"]
    files = gh.all(f"{R}/pulls/{num}/files")
    commits = [c["commit"]["message"] for c in gh.all(f"{R}/pulls/{num}/commits")]
    tree = gh.call("GET", f"{R}/git/trees/{head}?recursive=1")["tree"]
    sizes = {t["path"]: t.get("size", 0) for t in tree if t["type"] == "blob"}
    file_text = {}
    for f in files:
        if f["status"] != "removed" and match_any(f["filename"], rules["dockerfile_globs"]):
            file_text[f["filename"]] = gh.call("GET", f"{R}/contents/{f['filename']}?ref={head}", raw=True)
    try:
        codeowners = gh.call("GET", f"{R}/contents/.github/CODEOWNERS?ref={base}", raw=True)
    except urllib.error.HTTPError:
        codeowners = ""
    author = pr["user"]["login"]
    labels = {l["name"] for l in pr["labels"]}
    events = gh.all(f"{R}/issues/{num}/events")
    last = [e for e in events if e.get("event") == "labeled" and e.get("label", {}).get("name") == rules["labels"]["override"]]
    override_by_other = rules["labels"]["override"] in labels and bool(last) and last[-1]["actor"]["login"] != author
    ctx = {"author": author, "branch": pr["head"]["ref"], "title": pr["title"], "body": pr.get("body") or "",
           "commits": commits, "files": files, "sizes": sizes, "tree": set(sizes), "file_text": file_text,
           "codeowners": codeowners, "override_by_other": override_by_other}

    findings = apply_override(evaluate(ctx, rules), ctx, rules)
    ai_ok, ai_summary, ai_issues = ai_review(ctx, rules)
    if override_by_other and "ai" in rules["overridable"] and rules["override_reason"] in ctx["body"]:
        for i in ai_issues:
            if i["severity"] == "막음":
                i["severity"], i["problem"] = "고침 권함", i["problem"] + " (예외 승인)"
    block = any(f["level"] == "block" for f in findings) or any(i["severity"] == "막음" for i in ai_issues)
    closed = pr["state"] == "closed"
    if block and not closed:
        try:
            gh.call("PATCH", f"{R}/pulls/{num}", {"state": "closed"})
            closed = True
        except urllib.error.HTTPError as e:
            print(f"[PR 닫기 실패] HTTP {e.code}: {e.read()[:300]!r}", file=sys.stderr)
    text = render(block, findings, ai_ok, ai_summary, ai_issues, head, rules, closed)

    # 댓글 하나를 계속 고쳐 쓴다
    mine = [c for c in gh.all(f"{R}/issues/{num}/comments") if c["user"]["login"] == BOT and c["body"].startswith(MARK)]
    if mine:
        gh.call("PATCH", f"{R}/issues/comments/{mine[0]['id']}", {"body": text})
    else:
        gh.call("POST", f"{R}/issues/{num}/comments", {"body": text})

    reviews = gh.all(f"{R}/pulls/{num}/reviews")
    old = [r for r in reviews if r["user"]["login"] == BOT and r["state"] == "CHANGES_REQUESTED"]
    block_label = rules["labels"]["block"]
    if block:
        if not any(r["commit_id"] == head for r in old):
            for r in old:
                gh.call("PUT", f"{R}/pulls/{num}/reviews/{r['id']}/dismissals", {"message": "새 커밋으로 다시 검사했다", "event": "DISMISS"})
            gh.call("POST", f"{R}/pulls/{num}/reviews", {"commit_id": head, "event": "REQUEST_CHANGES",
                                                          "body": "리뷰봇 판정: 막음. 자세한 내용은 리뷰봇 댓글에 있다."})
        if block_label not in labels:
            gh.call("POST", f"{R}/issues/{num}/labels", {"labels": [block_label]})
        print(text)
        return 1
    if block_label in labels:
        gh.call("DELETE", f"{R}/issues/{num}/labels/{urllib.request.quote(block_label)}")
        if pr["state"] == "closed" and not pr.get("merged"):  # 봇이 닫았던 PR을 다시 연다
            gh.call("PATCH", f"{R}/pulls/{num}", {"state": "open"})
    # 해제는 다시 연 뒤에 한다(닫힌 PR에서는 해제가 반영되지 않았다, 2026-10-29 시험 PR #3)
    for r in old:
        res = gh.call("PUT", f"{R}/pulls/{num}/reviews/{r['id']}/dismissals", {"message": "다시 검사해 통과했다", "event": "DISMISS"})
        print(f"[변경 요청 해제] 리뷰 {r['id']}: {res.get('state') if res else '응답 없음'}", file=sys.stderr)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
