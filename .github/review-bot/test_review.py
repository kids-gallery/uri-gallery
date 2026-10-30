"""리뷰봇 규칙 시험 — 의도한 판정(막음·경고·통과)을 사례로 확인한다. 실행: python3 .github/review-bot/test_review.py"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import review  # noqa: E402

RULES = review.load_rules()
OWNERS = "* @wpalswpa\n/web/ @zozu001\n/api/ @tlswlgus960-prog\n/serving/ @wpalswpa\n"
BODY = """## 관련 이슈
Closes #12

## 설계서
설계서: 계획서 3-2

## 변경 사항
- api/Dockerfile: api 이미지

## 확인한 것
- `docker build -t api api` 종료 코드 0, 이미지 412MB

## 남은 것
- 없음
"""
DOCKERFILE = "FROM node:22-slim AS build\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nFROM node:22-slim\nCOPY --from=build /app /app\n"


def good():
    return {
        "author": "tlswlgus960-prog", "branch": "feat/12-api-image", "title": "api 이미지", "body": BODY,
        "commits": ["feat: api 이미지 추가 (#12)"],
        "files": [{"filename": "api/Dockerfile", "status": "added", "additions": 7, "deletions": 0,
                   "patch": "\n".join("+" + l for l in DOCKERFILE.splitlines())}],
        "sizes": {"api/Dockerfile": 200, "api/.dockerignore": 30}, "tree": {"api/Dockerfile", "api/.dockerignore"},
        "file_text": {"api/Dockerfile": DOCKERFILE}, "codeowners": OWNERS, "override_by_other": False,
    }


def rules_hit(ctx, level="block"):
    return {f["rule"] for f in review.apply_override(review.evaluate(ctx, RULES), ctx, RULES) if f["level"] == level}


class Rules(unittest.TestCase):
    def test_good_pr_passes(self):
        self.assertEqual(rules_hit(good()), set())
        self.assertEqual(rules_hit(good(), "warn"), set())

    def test_untouched_template_blocks(self):
        c = good()
        with open(os.path.join(os.path.dirname(__file__), "..", "pull_request_template.md"), encoding="utf-8") as f:
            c["body"] = f.read()
        self.assertTrue({"issue_link", "template"} <= rules_hit(c))

    def test_evidence_needs_command_or_number(self):
        c = good(); c["body"] = BODY.replace("- `docker build -t api api` 종료 코드 0, 이미지 412MB", "- 잘 됨")
        self.assertIn("evidence", rules_hit(c))

    def test_branch_and_commit(self):
        c = good(); c["branch"] = "scratch"; c["commits"] = ["scratch-b commit sss", "Merge branch 'main' into x"]
        self.assertTrue({"branch", "commit"} <= rules_hit(c))
        c = good(); c["branch"] = "feature/12-api-image"  # 핸드북 실습 때 쓴 이름
        self.assertNotIn("branch", rules_hit(c))
        c = good(); c["commits"] = ["feat: api 이미지 추가"]  # 이슈 번호 없음
        self.assertIn("commit", rules_hit(c))

    def test_secret_and_env_file(self):
        c = good()
        c["files"].append({"filename": ".env", "status": "added", "additions": 1, "deletions": 0,
                           "patch": "+SESSION_SECRET=abcdefgh12345678"})
        self.assertTrue({"secret", "forbidden"} <= rules_hit(c))
        c = good()
        c["files"].append({"filename": ".env.example", "status": "added", "additions": 2, "deletions": 0,
                           "patch": "+SESSION_SECRET=\n+DB_PASSWORD=<바꿀 값>"})
        self.assertEqual(rules_hit(c) & {"secret", "forbidden"}, set())

    def test_code_call_is_not_secret(self):
        c = good()
        c["files"][0]["patch"] += "\n+const token = verifyFileToken(req.params.token);"
        self.assertNotIn("secret", rules_hit(c))

    def test_weights_and_big_file(self):
        c = good()
        c["files"].append({"filename": "models/m1/model.safetensors", "status": "added", "additions": 0, "deletions": 0})
        c["sizes"]["models/m1/model.safetensors"] = 900 * 1048576
        self.assertTrue({"forbidden", "big_file"} <= rules_hit(c))

    def test_design_first(self):
        c = good(); c["body"] = BODY.replace("설계서: 계획서 3-2", "설계서: 해당 없음")
        self.assertIn("design_first", rules_hit(c))
        c["files"].append({"filename": "design/PLAN_x.md", "status": "modified", "additions": 3, "deletions": 0, "patch": "+x"})
        self.assertNotIn("design_first", rules_hit(c))

    def test_scope_out_in_compose(self):
        c = good()
        c["files"].append({"filename": "compose.yaml", "status": "added", "additions": 2, "deletions": 0,
                           "patch": "+  prometheus:\n+    image: prom/prometheus:v2.53.0"})
        self.assertIn("scope_out", rules_hit(c))

    def test_docs_mentioning_scope_words_are_fine(self):
        c = good()
        c["files"].append({"filename": "docs/note.md", "status": "added", "additions": 1, "deletions": 0,
                           "patch": "+모니터링(Prometheus)은 하지 않는다"})
        self.assertNotIn("scope_out", rules_hit(c))

    def test_size(self):
        c = good(); c["files"][0]["additions"] = 400
        self.assertIn("size", rules_hit(c, "warn"))
        c["files"][0]["additions"] = 700
        self.assertIn("size", rules_hit(c))
        c = good()
        c["files"].append({"filename": "web/package-lock.json", "status": "modified", "additions": 5000, "deletions": 0})
        self.assertNotIn("size", rules_hit(c) | rules_hit(c, "warn"))

    def test_dockerfile_tag_and_ignore(self):
        c = good(); c["file_text"]["api/Dockerfile"] = "FROM node\nCOPY . .\n"
        self.assertIn("docker_tag", rules_hit(c))
        c["file_text"]["api/Dockerfile"] = "FROM python:latest\n"
        self.assertIn("docker_tag", rules_hit(c))
        c = good(); c["tree"] = {"api/Dockerfile"}
        self.assertIn("dockerignore", rules_hit(c))
        c["tree"] = {"api/Dockerfile", ".dockerignore"}
        self.assertNotIn("dockerignore", rules_hit(c))

    def test_digest_and_stage_refs_ok(self):
        self.assertEqual(review.docker_base_problems("FROM python@sha256:abc\nFROM node:22 AS b\nFROM b\n"), [])

    def test_bot_self_override_only_by_other(self):
        c = good()
        c["files"].append({"filename": ".github/review-bot/rules.json", "status": "modified", "additions": 1, "deletions": 1, "patch": "+x"})
        self.assertIn("bot_self", rules_hit(c))
        c["override_by_other"] = True
        self.assertIn("bot_self", rules_hit(c))  # 이유가 없으면 그대로 막음
        c["body"] += "\n예외 이유: 팀 합의 #20\n"
        self.assertNotIn("bot_self", rules_hit(c))
        self.assertIn("bot_self", rules_hit(c, "warn"))

    def test_override_never_covers_secret(self):
        c = good(); c["override_by_other"] = True; c["body"] += "\n예외 이유: x\n"
        c["files"][0]["patch"] += "\n+-----BEGIN RSA PRIVATE KEY-----"
        self.assertIn("secret", rules_hit(c))

    def test_foreign_folder_is_warning(self):
        c = good(); c["author"] = "zozu001"
        self.assertIn("owner", rules_hit(c, "warn"))
        self.assertNotIn("owner", rules_hit(c))


class AI(unittest.TestCase):
    def test_block_needs_real_file(self):
        text = json.dumps({"summary": "s", "issues": [
            {"file": "api/Dockerfile", "severity": "막음", "rule": "B4", "problem": "p", "fix": "f"},
            {"file": "없는/파일.ts", "severity": "막음", "rule": "B4", "problem": "p", "fix": "f"},
            {"file": "api/Dockerfile", "severity": "아주 나쁨", "problem": "p", "fix": "f"},
            {"file": "api/Dockerfile", "severity": "막음", "problem": "번호 없음", "fix": "f"},
            {"file": "api/Dockerfile", "severity": "막음", "rule": "B9", "problem": "지침에 없는 번호", "fix": "f"}]})
        _, issues = review.parse_ai(text, ["api/Dockerfile"], RULES)
        self.assertEqual([i["severity"] for i in issues], ["막음", "고침 권함", "참고", "고침 권함", "고침 권함"])
        self.assertTrue(issues[0]["problem"].startswith("[B4] "))

    def test_guide_lists_block_rules_and_goes_to_ai(self):
        self.assertEqual(review.block_rules(), {"B1", "B2", "B3", "B4", "B5"})

    def test_fenced_json_is_read(self):
        text = '```json\n{"summary": "s", "issues": []}\n```'
        self.assertEqual(review.parse_ai(text, [], RULES), ("s", []))

    def test_render_tells_when_close_failed(self):
        text = review.render(True, [], True, "s", [], "abcdef1", RULES, closed=False)
        self.assertIn("닫지 못했다", text)

    def test_ai_off_without_settings(self):
        for k in ("REVIEW_AI_MODEL", "REVIEW_AI_KEY"):
            os.environ.pop(k, None)
        ok, summary, issues = review.ai_review(good(), RULES)
        self.assertEqual((ok, issues), (False, []))
        self.assertIn("꺼져 있다", summary)

    def test_cache_reused_only_for_same_commit_and_body(self):
        c = dict(good(), head="abc123")
        key = review.ai_key(c)
        cache = json.dumps({"key": key, "summary": "s", "issues": []})
        text = review.render(False, [], True, "s", [], "abc123", RULES, True, cache)
        self.assertEqual(review.cached_ai(text, key), (True, "s", []))
        self.assertIsNone(review.cached_ai(text, review.ai_key(dict(c, body=c["body"] + "x"))))
        self.assertIsNone(review.cached_ai(text, review.ai_key(dict(c, head="def456"))))

    def test_claude_request_and_answer(self):
        from unittest import mock
        seen = {}

        class Resp:
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self):
                return json.dumps({"content": [{"type": "text", "text": '{"summary": "요약", "issues": [{"file": "api/Dockerfile", "severity": "막음", "rule": "B2", "problem": "p", "fix": "f"}]}'}]}).encode()

        def fake(req, timeout):
            seen["url"], seen["headers"], seen["body"] = req.full_url, dict(req.header_items()), json.loads(req.data)
            return Resp()

        with mock.patch.dict(os.environ, {"REVIEW_AI_KEY": "k", "REVIEW_AI_MODEL": ""}), mock.patch("urllib.request.urlopen", fake):
            ok, summary, issues = review.ai_review(good(), RULES)
        self.assertEqual((ok, summary, issues[0]["severity"]), (True, "요약", "막음"))
        self.assertEqual(seen["url"], RULES["ai"]["endpoint"])
        self.assertEqual(seen["headers"].get("X-api-key"), "k")
        self.assertEqual(seen["body"]["model"], RULES["ai"]["model"])
        self.assertNotIn("temperature", seen["body"])
        self.assertIn("지적하지 않는 것", seen["body"]["system"])   # 지침 파일이 그대로 간다

    def test_thinking_first_and_output_limit(self):
        from unittest import mock

        def answer(body):
            class Resp:
                def __enter__(self): return self
                def __exit__(self, *a): return False
                def read(self): return json.dumps(body).encode()
            return lambda req, timeout: Resp()

        thinking = {"type": "thinking", "thinking": "", "signature": "s"}
        done = {"stop_reason": "end_turn", "content": [thinking, {"type": "text", "text": '{"summary": "요약", "issues": []}'}]}
        cut = {"stop_reason": "max_tokens", "content": [thinking, {"type": "text", "text": '{"summary": "요'}]}
        with mock.patch.dict(os.environ, {"REVIEW_AI_KEY": "k", "REVIEW_AI_MODEL": ""}):
            with mock.patch("urllib.request.urlopen", answer(done)):
                self.assertEqual(review.ai_review(good(), RULES)[:2], (True, "요약"))
            with mock.patch("urllib.request.urlopen", answer(cut)):
                ok, summary, _ = review.ai_review(good(), RULES)
        self.assertFalse(ok)
        self.assertIn("출력 한도", summary)

    def test_key_with_non_ascii_is_reported(self):
        from unittest import mock
        with mock.patch.dict(os.environ, {"REVIEW_AI_KEY": "sk-ant-api03-키값"}):
            ok, summary, _ = review.ai_review(good(), RULES)
        self.assertFalse(ok)
        self.assertIn("다시 등록", summary)

    def test_bad_json_raises(self):
        with self.assertRaises(ValueError):
            review.parse_ai("이건 JSON이 아니다", [], RULES)

    def test_render_marks_block(self):
        f = review.evaluate(dict(good(), branch="x"), RULES)
        text = review.render(True, f, False, "AI 검토가 꺼져 있다.", [], "abcdef123", RULES)
        self.assertTrue(text.startswith(review.MARK))
        self.assertIn("막음 1건", text)
        self.assertIn("AI 검토 못 함", text)


if __name__ == "__main__":
    unittest.main()
