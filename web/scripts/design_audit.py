"""디자인 진단(SD_02 17-20, 단계 1) — 모든 화면을 390·1280px로 캡처하고 화면 × 항목 점검표를 만든다.

  ~/.local/share/ai-mcp/python-env/bin/python web/scripts/design_audit.py [출력 폴더]
  환경: BASE(기본 http://127.0.0.1:9501, 개발 서버), BASE_WORLD(3D 세계를 띄운 주소, 기본 BASE),
        MAIL(기본 http://127.0.0.1:8125, E2E 스택 Mailpit), OPS_EMAIL·OPS_PASSWORD(기본 E2E 스택 팀원).
  먼저 E2E 스택(web/e2e/stack)과 개발 서버(APP_API_URL=http://127.0.0.1:9621 npm run dev)를 띄운다.

자동으로 세는 것은 "의심"이다. 표의 판정은 캡처를 사람이 보고 확정한다(진단 문서에 적는다).
같은 스크립트를 디자인 적용 뒤 다시 돌려 '문제 없음'을 확인한다(단계 4 ⑤).
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_api as smoke  # noqa: E402  가입·업로드 도우미

BASE = os.environ.get("BASE", "http://127.0.0.1:9501")
BASE_WORLD = os.environ.get("BASE_WORLD", BASE)
smoke.BASE = BASE
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / ".data" / "design-audit" / time.strftime("%Y%m%d-%H%M"))
WIDTHS = {"390": (390, 844), "1280": (1280, 800)}
DEV_WORDS = re.compile(r"\b(test|todo|fixme|lorem|undefined|null|nan|debug|dev|fake|mock|stub|error|exception)\b|테스트|개발용|\[object", re.I)

# 화면 목록(web/src/router/index.ts). who: 누구로 보나. states: 추가로 볼 상태
SCREENS = [
    ("welcome", "/app/welcome", "public", []),
    ("sample", "/app/sample", "public", []),
    ("login", "/app/login", "public", ["error"]),
    ("signup", "/app/signup", "public", []),
    ("verify", "/app/verify?token=wrong", "public", []),
    ("recovery", "/app/recovery", "public", []),
    ("reset", "/app/reset?token=wrong", "public", []),
    ("invite", "/app/invite?token=wrong", "public", []),
    ("world", "/app/world", "world", []),
    ("home", "/app", "data", ["loading", "error"]),
    ("home-empty", "/app", "empty", []),
    ("museum", "/app/museum/{child}", "data", ["loading", "error"]),
    ("town", "/app/town", "data", ["loading", "error"]),
    ("neighbor", "/app/neighbor", "data", []),
    ("children-new", "/app/children/new", "data", []),
    ("corridor", "/app/corridor", "data", []),
    ("list", "/app/list", "data", ["loading", "error"]),
    ("hall", "/app/hall", "data", ["loading", "error"]),
    ("works", "/app/works", "data", ["loading", "error"]),
    ("works-empty", "/app/works", "empty", []),
    ("artwork", "/app/artworks/{artwork}", "data", ["loading", "error"]),
    ("confirm", "/app/artworks/{pending}/confirm", "data", []),
    ("review", "/app/artworks/{artwork}/review", "data", []),
    ("story", "/app/artworks/{artwork}/story", "data", []),
    ("upload", "/app/upload", "data", []),
    ("children", "/app/children", "data", ["loading", "error"]),
    ("account", "/app/account", "data", []),
    ("family", "/app/family", "data", []),
    ("no-family", "/app/no-family", "data", []),
    ("ops-login", "/ops/login", "public", []),
    ("ops-status", "/ops/status", "ops", ["loading", "error"]),
    ("ops-models", "/ops/models", "ops", []),
    ("ops-api-guide", "/ops/api-guide", "ops", []),
]

# 화면 안에서 재는 것(브라우저에서 실행)
PROBE = r"""() => {
  const vw = innerWidth, out = {};
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const els = [...document.querySelectorAll('body *')].filter(vis);
  // 1 기본값 노출
  const def = [];
  for (const e of els) {
    const s = getComputedStyle(e), t = e.tagName;
    if ((t === 'BUTTON' || (t === 'INPUT' && /button|submit/.test(e.type))) && (/outset/.test(s.borderStyle) || s.backgroundColor === 'rgb(239, 239, 239)' || s.backgroundColor === 'rgb(240, 240, 240)')) def.push('button:' + (e.innerText || e.value || '').trim().slice(0, 20));
    if ((t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') && /inset/.test(s.borderStyle)) def.push('input:' + (e.name || e.type));
    if (t === 'A' && (s.color === 'rgb(0, 0, 238)' || s.color === 'rgb(85, 26, 139)')) def.push('link:' + e.innerText.trim().slice(0, 20));
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t) && s.fontFamily !== bodyFont && /Arial|Helvetica|system-ui|-apple-system|Times/i.test(s.fontFamily) && !/Pretendard|Inter/i.test(s.fontFamily)) def.push('font:' + t.toLowerCase());
    if (t === 'BODY' && /Times/.test(s.fontFamily)) def.push('font:body');
  }
  out.defaults = [...new Set(def)].slice(0, 12);
  // 2 정렬·간격: 화면 끝에 붙은 글자·버튼, 가로 넘침
  const edge = [];
  for (const e of els) {
    if (!e.childElementCount && (e.innerText || '').trim() || /^(BUTTON|A|INPUT)$/.test(e.tagName)) {
      const r = e.getBoundingClientRect();
      if (r.width < vw - 2 && (r.left < 6 || r.right > vw - 6) && r.bottom > 0 && r.top < innerHeight * 3) edge.push((e.innerText || e.tagName).trim().slice(0, 16));
    }
  }
  out.edge = [...new Set(edge)].slice(0, 8);
  out.overflowX = document.documentElement.scrollWidth > vw + 1;
  // 3 위계
  const sizes = new Set(), btnStyles = new Set();
  for (const e of els) {
    if (e.childElementCount === 0 && (e.innerText || '').trim()) sizes.add(getComputedStyle(e).fontSize);
    if (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') { const s = getComputedStyle(e); btnStyles.add([s.backgroundColor, s.color, s.borderColor, s.borderRadius].join('|')); }
  }
  out.fontSizes = [...sizes].sort((a, b) => parseFloat(a) - parseFloat(b));
  out.buttonStyles = btnStyles.size;
  out.h1 = [...document.querySelectorAll('h1')].filter(vis).length;
  // 6 개발 흔적(글자)
  out.text = document.body.innerText.slice(0, 4000);
  // 7 자원
  const broken = [], stretched = [];
  for (const im of document.images) {
    if (!vis(im)) continue;
    if (im.complete && im.naturalWidth === 0) broken.push(im.getAttribute('src')?.slice(0, 40));
    else if (im.naturalWidth) { const r = im.getBoundingClientRect(), fit = getComputedStyle(im).objectFit; const d = Math.abs(r.width / r.height - im.naturalWidth / im.naturalHeight) / (im.naturalWidth / im.naturalHeight); if (d > 0.04 && (fit === 'fill' || !fit)) stretched.push(im.getAttribute('src')?.slice(0, 40)); }
  }
  out.broken = broken; out.stretched = stretched;
  // 8 위에 뜬 패널끼리 겹침·화면 밖으로 잘림(fixed·absolute이고 누를 수 있는 것)
  const pan = els.filter((e) => /fixed|absolute/.test(getComputedStyle(e).position) && e.querySelector('button,a,input') && e.getBoundingClientRect().width < vw * 0.98);
  const over = [], clip = [];
  for (let i = 0; i < pan.length; i++) {
    const a = pan[i].getBoundingClientRect();
    if (a.left < -1 || a.top < -1 || a.right > vw + 1 || a.bottom > innerHeight + 1) clip.push(pan[i].className.toString().slice(0, 30));
    for (let j = i + 1; j < pan.length; j++) {
      if (pan[i].contains(pan[j]) || pan[j].contains(pan[i])) continue;
      const b = pan[j].getBoundingClientRect(), w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) over.push(pan[i].className.toString().slice(0, 20) + '×' + pan[j].className.toString().slice(0, 20));
    }
  }
  out.panelOverlap = [...new Set(over)].slice(0, 6); out.panelClip = [...new Set(clip)].slice(0, 6);
  return out;
}"""

FOCUS = r"""() => { const e = document.activeElement; if (!e || e === document.body) return null;
  const s = getComputedStyle(e); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  return { tag: e.tagName, text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20), ring }; }"""


def setup_accounts() -> dict:
    """작품이 있는 계정·빈 계정·운영 계정을 만든다(시험 데이터, 실제 사용자 없음)."""
    data = {}
    smoke.jar.clear(); data["data_email"] = smoke.signup()
    _, child = smoke.call("POST", "/v1/children", {"alias": "하늘"}); data["child"] = child["id"]
    sample = Path(__file__).resolve().parent / "audit-sample.png"
    a = smoke.upload(child["id"], sample); smoke.wait_stages(a["id"], 600)
    _, a = smoke.call("GET", f"/v1/artworks/{a['id']}")
    kind = "relief" if "relief" in (a.get("choices") or []) else "frame"  # 모델이 없는 환경은 원본 액자만 고를 수 있다
    smoke.call("POST", f"/v1/artworks/{a['id']}/confirm", {"kind": kind}); a, _ = smoke.wait_stages(a["id"], 900)
    if a.get("state") == "awaiting_review":
        smoke.call("POST", f"/v1/artworks/{a['id']}/decision", {"decision": "like"})
    data["artwork"] = a["id"]
    b = smoke.upload(child["id"], sample); smoke.wait_stages(b["id"], 600); data["pending"] = b["id"]  # 확정 전
    data["data_cookies"] = [c.__dict__ for c in smoke.jar]
    smoke.jar.clear(); data["empty_email"] = smoke.signup(); data["empty_cookies"] = [c.__dict__ for c in smoke.jar]
    # 운영 계정은 E2E 스택이 운영 CLI로 만든 팀원(web/e2e/stack/ports.ts STAFF)
    ops_email, ops_pw = os.environ.get("OPS_EMAIL", "staff@e2e.test"), os.environ.get("OPS_PASSWORD", "e2e-Staff-2026")
    data["ops"] = (ops_email, ops_pw)
    return data


def cookies_for(raw: list[dict], base: str) -> list[dict]:
    host = re.sub(r"^https?://", "", base).split(":")[0]
    return [{"name": c["name"], "value": c["value"], "domain": host, "path": c.get("path") or "/"} for c in raw]


def login_ops(page: Page, email: str, pw: str) -> None:
    page.goto(BASE + "/ops/login"); page.wait_for_load_state("networkidle")
    try:
        page.fill("input[type=email], input[name=email]", email, timeout=5000); page.fill("input[type=password]", pw, timeout=5000)
        page.keyboard.press("Enter"); page.wait_for_timeout(1500)
    except Exception as e:  # noqa: BLE001
        print("운영 로그인 실패:", str(e)[:120], file=sys.stderr)


def shoot(page: Page, name: str) -> str:
    p = OUT / f"{name}.png"
    try:
        page.screenshot(path=str(p), full_page=True, timeout=15000)
    except Exception:  # noqa: BLE001  아주 긴 화면은 보이는 영역만
        page.screenshot(path=str(p), timeout=15000)
    return p.name


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    acc = setup_accounts()
    rows = []
    n = 0
    with sync_playwright() as pw:
        br = pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for wkey, (w, h) in WIDTHS.items():
            ctxs = {}
            for who in ("public", "data", "empty", "ops", "world"):
                c = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, locale="ko-KR")
                if who in ("data", "empty"):
                    c.add_cookies(cookies_for(acc[f"{who}_cookies"], BASE))
                if who == "ops":
                    login_ops(c.new_page(), *acc["ops"])
                ctxs[who] = c
            for sid, path, who, states in SCREENS:
                url = (BASE_WORLD if who == "world" else BASE) + path.format(child=acc["child"], artwork=acc["artwork"], pending=acc["pending"])
                for state in ["normal"] + states:
                    page = ctxs[who].new_page()
                    if state == "loading":
                        page.route("**/v1/**", lambda r: (time.sleep(4), r.continue_()))
                    if state == "error":
                        page.route("**/v1/**", lambda r: r.fulfill(status=503, content_type="application/problem+json",
                                                                 body='{"type":"about:blank","title":"unavailable","status":503,"code":"unavailable"}') if r.request.method == "GET" or "login" in r.request.url else r.continue_())
                    t0 = time.time()
                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_timeout(900 if state == "loading" else (4000 if who == "world" else 1800))
                    except Exception as e:  # noqa: BLE001
                        rows.append({"screen": sid, "width": wkey, "state": state, "error": str(e)[:200]}); page.close(); continue
                    if state == "error" and sid == "login":
                        try:  # 입력 칸이 없으면(로그인 방식을 못 받아 옴) 그 화면 그대로 남긴다
                            page.fill("input[type=email], input[name=email]", "x@example.com", timeout=3000); page.fill("input[type=password]", "wrong-password", timeout=3000)
                            page.keyboard.press("Enter"); page.wait_for_timeout(1200)
                        except Exception:  # noqa: BLE001
                            pass
                    try:
                        n += 1; shot = shoot(page, f"{n:03d}-{sid}-{wkey}-{state}")
                    except Exception as e:  # noqa: BLE001
                        rows.append({"screen": sid, "width": wkey, "state": state, "error": "capture: " + str(e)[:160]}); page.close(); continue
                    probe = page.evaluate(PROBE)
                    row = {"screen": sid, "width": wkey, "state": state, "url": page.url.replace(BASE, ""), "shot": shot, **probe,
                           "devText": sorted({m.group(0) for m in DEV_WORDS.finditer(probe.pop("text") if "text" in probe else "")})[:10]}
                    row.pop("text", None)
                    if state == "normal":
                        focus = []
                        for _ in range(3):
                            page.keyboard.press("Tab"); f = page.evaluate(FOCUS)
                            if f: focus.append(f)
                        row["focus"] = focus
                        n += 1; row["focusShot"] = shoot(page, f"{n:03d}-{sid}-{wkey}-focus")
                        btn = page.locator("button:visible").first
                        if btn.count():
                            before = btn.evaluate("e => { const s = getComputedStyle(e); return [s.backgroundColor, s.color, s.boxShadow, s.transform, s.borderColor].join('|') }")
                            try:
                                btn.hover(timeout=2000); page.wait_for_timeout(250)
                                after = btn.evaluate("e => { const s = getComputedStyle(e); return [s.backgroundColor, s.color, s.boxShadow, s.transform, s.borderColor].join('|') }")
                                row["hoverChanges"] = before != after
                                n += 1; row["hoverShot"] = shoot(page, f"{n:03d}-{sid}-{wkey}-hover")
                            except Exception:  # noqa: BLE001
                                row["hoverChanges"] = None
                    row["seconds"] = round(time.time() - t0, 1)
                    rows.append(row); page.close()
            for c in ctxs.values(): c.close()
        br.close()
    (OUT / "audit.json").write_text(json.dumps({"base": BASE, "baseWorld": BASE_WORLD, "rows": rows}, ensure_ascii=False, indent=1))
    print(json.dumps({"out": str(OUT), "shots": n, "rows": len(rows)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
