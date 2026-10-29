// Run from web: node scripts/world-release-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-22 '독립 검토 반영'(지적 1~10)의 고친 동작을 실제 브라우저로 확인한다. 합성 이미지만 쓴다.
// 개발 서버(5173) 전용: 저장 모듈을 화면 밖에서 직접 불러 기록을 읽는다. 사람 기기 값(휴대폰·iPhone 공유 시트)은 여기서 재지 않는다.
import { chromium, devices } from '@playwright/test';
import { reviewBrowser, startWorld } from './review-browser.mjs';
import fs from 'node:fs';

const out = process.argv[2] ?? '/private/tmp/uam-release-review'; fs.mkdirSync(out, { recursive: true });
const URL0 = 'http://127.0.0.1:5173/app/world', STORE = '/src/app/world/store.ts';
const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); };
const browser = await reviewBrowser();
const errors = [];
async function page(opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon\.ico/.test(m.location()?.url ?? '')) errors.push(m.text()); });
  return { ctx, p };
}
// 종이 바탕에 색 동그라미 그림(배경 지우기가 윤곽을 찾는 그림). type: image/png | image/jpeg
const images = (p, n, type = 'image/png') => p.evaluate(async ([n, type]) => {
  const list = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d');
    x.fillStyle = '#fffdf5'; x.fillRect(0, 0, 400, 300); x.fillStyle = `hsl(${(i * 37) % 360} 70% 45%)`; x.beginPath(); x.arc(200, 150, 90, 0, 7); x.fill();
    const b = await new Promise((r) => c.toBlob(r, type, 0.92)); list.push(Array.from(new Uint8Array(await b.arrayBuffer())));
  }
  return list;
}, [n, type]).then((l) => l.map((bytes, i) => ({ name: `그림${i + 1}.${type === 'image/png' ? 'png' : 'jpg'}`, mimeType: type, buffer: Buffer.from(bytes) })));
const card = (p) => p.getByRole('status', { name: '작품 전시 완료' });
async function uploadFirst(p, files) {
  const fc = p.waitForEvent('filechooser'); await p.getByRole('button', { name: '사진 고르기', exact: true }).click();
  await (await fc).setFiles(files); await card(p).waitFor({ timeout: 60000 });
}
const mine = (p) => p.evaluate(() => [...window.__uamWorld.artworks.values()].filter((a) => !a.sample).sort((a, b) => a.no - b.no).map((a) => ({ id: a.id, state: a.cutoutState, rotation: a.rotation ?? 0, age: a.age, subject: a.subject })));
async function settled(p) { for (let i = 0; i < 200; i++) { if (!(await mine(p)).some((a) => a.state === 'pending')) return true; await p.waitForTimeout(100); } return false; }

try {
  // ── 지적 1: 6장·10장 묶음을 올리면 마지막 작품 앞에 선다(벽 5·9번 칸이 마지막) ──
  for (const n of [6, 10]) {
    const { ctx, p } = await page();
    await p.goto(URL0); await startWorld(p); await uploadFirst(p, await images(p, n)); await settled(p); await p.waitForTimeout(1500);
    const at = await p.evaluate(() => { const e = window.__uamWorld, m = e.museum, a = e.avatarRoot.position, list = [...e.artworks.values()].filter((x) => !x.sample).sort((x, y) => x.no - y.no), w = m.works.get(list.at(-1).id); return { region: m.regionOf(a.x, a.z).kind, dist: +Math.hypot(w.stand.x - a.x, w.stand.z - a.z).toFixed(2), blocked: [...m.works.values()].filter((x) => !m.canStand(x.stand.x, x.stand.z)).length }; });
    ok(`batch of ${n}: stands in front of the last work, result card shown (review 1)`, at.region === 'room' && at.dist < 0.5 && at.blocked === 0 && await card(p).isVisible(), at);
    await p.screenshot({ path: `${out}/1-batch-${n}.png` }); await ctx.close();
  }

  // ── 지적 2: 돌리는 동안 나이 단추가 잠기고, 돌리기와 정보 저장을 겹쳐 불러도 서로 덮지 않는다 ──
  {
    const { ctx, p } = await page();
    await p.goto(URL0); await startWorld(p); await uploadFirst(p, await images(p, 1));
    await p.getByRole('button', { name: '오른쪽으로 돌리기' }).click();
    const locked = await p.getByRole('button', { name: '5세', exact: true }).isDisabled();
    await p.getByRole('button', { name: '오른쪽으로 돌리기' }).and(p.locator(':enabled')).waitFor({ timeout: 15000 }); await settled(p);
    const r = await p.evaluate(async (s) => {
      const st = await import(s), a = (await st.listArtworks()).find((x) => !x.sample);
      const turn = st.setRotation(a.id, 180); await new Promise((res) => setTimeout(res, 0));
      await Promise.all([turn, st.updateArtworkInfo(a.id, { title: a.title, age: 5, madeOn: a.madeOn, words: '어흥', material: a.material, kind: a.kind, subject: 'tiger' })]);
      const b = (await st.listArtworks()).find((x) => x.id === a.id); return { rotation: b.rotation, age: b.age, subject: b.subject, words: b.words };
    }, STORE);
    ok('rotating locks the age buttons; rotation and info saves keep each other (review 2)', locked && r.rotation === 180 && r.age === 5 && r.subject === 'tiger' && r.words === '어흥', { locked, ...r });
    await ctx.close();
  }

  // ── 지적 8: 배경 지우기가 도는 동안 ↻↺↻↺로 돌려도 처리 전으로 남지 않고 마지막 방향으로 처리한다 ──
  // 배경 지운 사본(PNG) 만들기만 1.5초 늦춘다. JPEG 사진을 올려 화면용 사본(JPEG)과 돌리기는 늦추지 않는다
  {
    const { ctx, p } = await page({}, () => {
      window.__pngCalls = 0; const orig = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { if (type === 'image/png') { window.__pngCalls++; setTimeout(() => orig.call(this, cb, type, q), 1500); } else orig.call(this, cb, type, q); };
    });
    await p.goto(URL0); await startWorld(p);
    const before = await p.evaluate(() => window.__pngCalls);
    await uploadFirst(p, await images(p, 1, 'image/jpeg'));
    const turns = [];
    for (const [i, name] of ['오른쪽으로 돌리기', '왼쪽으로 돌리기', '오른쪽으로 돌리기', '왼쪽으로 돌리기'].entries()) {
      const started = await p.waitForFunction((n) => window.__pngCalls >= n, before + i + 1, { timeout: 20000 }).then(() => true).catch(() => false);
      if (!started) { turns.push(`attempt ${i + 1} did not start`); break; }
      await p.getByRole('button', { name }).click(); await p.getByRole('button', { name }).and(p.locator(':enabled')).waitFor({ timeout: 15000 }); turns.push(name);
    }
    let last = null; for (let i = 0; i < 150; i++) { last = (await mine(p))[0]; if (last.state !== 'pending') break; await p.waitForTimeout(100); }
    const masked = await p.evaluate((id) => window.__uamWorld.debugWork(id).masked, last.id);
    ok('rotating back and forth during background removal still ends processed in the last direction (review 8)', turns.length === 4 && last.state === 'done' && last.rotation === 0 && masked, { turns, last, masked, pngCalls: await p.evaluate(() => window.__pngCalls) });
    await ctx.close();
  }

  // ── 지적 3·4·10: 백업 [파일 보내기]·저장 상태 줄·자랑하기 [파일 보내기]·체크 상자 높이(터치 기기 흉내) ──
  {
    const { ctx, p } = await page({ ...devices['Pixel 7'] }, () => {
      Navigator.prototype.canShare = () => true;
      Navigator.prototype.share = async () => {
        if (window.__slow) { window.__slow = false; await new Promise((r) => setTimeout(r, 800)); throw new DOMException('not activated', 'NotAllowedError'); }
        if ((window.__rej ?? 0) > 0) { window.__rej -= 1; throw new DOMException('not activated', 'NotAllowedError'); }
      };
    });
    await p.goto(URL0); await startWorld(p); await uploadFirst(p, await images(p, 1));
    await p.getByRole('button', { name: '계속 둘러보기' }).click();
    const dialog = p.getByRole('dialog', { name: '설정' }), again = dialog.getByRole('button', { name: '파일 보내기' });
    const settings = async () => { await p.getByRole('button', { name: '더보기' }).click(); await p.getByRole('button', { name: '설정' }).click(); await dialog.waitFor(); };
    const close = async () => { await dialog.getByRole('button', { name: '닫기' }).click(); await dialog.waitFor({ state: 'detached' }); };
    await settings();
    const made = await p.evaluate(() => { window.__rej = 1; return Date.now(); });
    await dialog.getByRole('button', { name: '백업 내보내기' }).click(); await again.waitFor({ timeout: 15000 }); await p.waitForTimeout(2000);
    const sent = await p.evaluate(() => Date.now()); await again.click(); await p.getByText(/백업 파일을 보냈어요/).waitFor({ timeout: 10000 });
    const mark = await p.evaluate(async (s) => (await import(s)).getBackupMark(), STORE);
    ok('late [파일 보내기] records the time the backup file was made (review 3)', mark.lastAt - made >= 0 && mark.lastAt - made < 1500 && sent - mark.lastAt >= 1500, { made: mark.lastAt - made, sent: sent - mark.lastAt });
    const line = (await dialog.innerText()).split('\n').filter((l) => /브라우저는|마지막 백업/.test(l)).join(' | ');
    ok('settings shows the storage state line like the privacy guide (review 4)', /이 브라우저는/.test(line) && /마지막 백업/.test(line), line);
    await p.evaluate(() => { window.__rej = 1; }); await dialog.getByRole('button', { name: '백업 내보내기' }).click(); await again.waitFor({ timeout: 15000 });
    await close(); await settings();
    ok('closing settings removes [파일 보내기] (review 3)', await again.count() === 0);
    await p.evaluate(() => { window.__slow = true; }); await dialog.getByRole('button', { name: '백업 내보내기' }).click(); await p.waitForTimeout(150); await close();
    const toast = await p.getByText('백업 파일을 보내지 못했어요. 설정에서 다시 내보내 주세요').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(300); await settings();
    ok('a refusal after settings closed shows a notice and leaves no [파일 보내기] or stale text (review 3)', toast && await again.count() === 0 && await dialog.getByText('[파일 보내기]를 한 번 더 눌러 주세요').count() === 0, { toast });
    await close();
    const view = p.locator('.w-view'), share = view.getByRole('button', { name: '파일 보내기' });
    const openView = async () => { await p.getByRole('button', { name: /가까이 보기/ }).first().click(); await view.waitFor(); };
    await openView();
    const heights = await view.locator('.w-share label').evaluateAll((ls) => ls.map((l) => Math.round(l.getBoundingClientRect().height)));
    ok('share checkboxes are at least 44px tall (review 10)', heights.length > 0 && heights.every((h) => h >= 44), heights);
    await p.evaluate(() => { window.__rej = 1; }); await view.getByRole('button', { name: '이 작품 자랑하기' }).click(); await share.waitFor({ timeout: 15000 });
    await view.getByRole('button', { name: '닫기' }).last().click(); await view.waitFor({ state: 'detached' }); await openView();
    ok('reopening the close view removes the old share [파일 보내기] (review 10)', await share.count() === 0);
    await ctx.close();
  }

  // ── 지적 5: 결과 카드가 화면 안에 들고, 돌리기를 누를 수 있고, 위쪽 단추와 작품을 가리지 않는다. 키보드 초점이 보인다 ──
  for (const [w, h, low] of [[750, 342, true], [945, 396, true], [700, 540, true], [800, 600, true], [390, 664, true], [1280, 800, false]]) {
    const { ctx, p } = await page({ viewport: { width: w, height: h } });
    await p.goto(URL0); await startWorld(p); await uploadFirst(p, await images(p, 1)); await p.waitForTimeout(800);
    const m = await p.evaluate(() => {
      const c = document.querySelector('.w-saved').getBoundingClientRect(), t = document.querySelector('[aria-label="오른쪽으로 돌리기"]').getBoundingClientRect();
      const at = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      const top = [...document.querySelectorAll('.hud-top .tools .g-btn')].filter((b) => b.getBoundingClientRect().width > 0).filter((b) => { const r = b.getBoundingClientRect(); return !(r.bottom <= c.top || r.top >= c.bottom || r.right <= c.left || r.left >= c.right); }).map((b) => b.innerText.trim());
      const e = window.__uamWorld, wr = e.debugWorkRect([...e.artworks.values()].find((a) => !a.sample).id);
      const cover = wr ? Math.max(0, Math.min(wr.right, c.right) - Math.max(wr.left, c.left)) * Math.max(0, Math.min(wr.bottom, c.bottom) - Math.max(wr.top, c.top)) / Math.max(1, (wr.right - wr.left) * (wr.bottom - wr.top)) : 1;
      const g = document.querySelector('.w-gestures');
      return { top: Math.round(c.top), bottom: Math.round(c.bottom), inView: c.top >= 0 && c.bottom <= innerHeight, turn: !!at?.closest('[aria-label="오른쪽으로 돌리기"]'), covers: top, cover: +cover.toFixed(2), gestures: !!g && g.getBoundingClientRect().width > 0 && getComputedStyle(g).display !== 'none' };
    });
    await p.getByRole('button', { name: '건너뛰기' }).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const f = await p.evaluate(() => { const el = document.activeElement, c = document.querySelector('.w-saved').getBoundingClientRect(), r = el.getBoundingClientRect(); return { chip: el.classList.contains('w-chip'), visible: r.top >= c.top && r.bottom <= c.bottom && r.bottom <= innerHeight }; });
    ok(`${w}x${h}: result card in view, rotate pressable, HUD and artwork clear, keyboard focus visible (review 5)`, m.inView && m.turn && !m.covers.length && m.cover <= 0.1 && f.chip && f.visible && m.gestures === !low, { ...m, focus: f });
    await p.screenshot({ path: `${out}/5-card-${w}x${h}.png` }); await ctx.close();
  }

  // ── 지적 6·10: 백업 권유 줄이 HUD·걷기 막대·몸짓 단추를 덮지 않는다. [사용 기록]을 열어도 중간에 뜨지 않는다 ──
  for (const [i, [label, opts]] of [['Pixel 7', devices['Pixel 7']], ['iPhone 13 landscape', devices['iPhone 13 landscape']], ['iPhone SE landscape', devices['iPhone SE landscape']], ['945x396', { viewport: { width: 945, height: 396 } }], ['1280x800', { viewport: { width: 1280, height: 800 } }]].entries()) {
    // iOS 흉내는 홈 화면 앱으로 연 것처럼 둔다(저장 안내 없이 올린다)
    const { ctx, p } = await page(opts, () => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
    await p.goto(URL0); await startWorld(p); await uploadFirst(p, await images(p, 10)); await p.getByRole('button', { name: '계속 둘러보기' }).click(); await p.waitForTimeout(400);
    const nudge = p.getByRole('status', { name: '백업 권유' });
    if (i === 0) {
      await p.getByRole('button', { name: '더보기' }).click(); await p.getByRole('button', { name: '사용 기록' }).click();
      const usage = p.getByRole('dialog', { name: '사용 기록' }); await usage.waitFor(); await usage.getByRole('button', { name: '닫기' }).click(); await p.waitForTimeout(400);
      ok('opening [사용 기록] does not bring up the backup nudge mid-session (review 10)', !(await nudge.isVisible().catch(() => false)));
    }
    await p.reload(); await startWorld(p); await nudge.waitFor({ timeout: 15000 });
    const r = await p.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
      const n = box(document.querySelector('.w-nudge'));
      const parts = { where: document.querySelector('.where'), mode: document.querySelector('.w-mode-chip'), joy: document.querySelector('.joy'), gestures: document.querySelector('.w-gestures'), ...Object.fromEntries([...document.querySelectorAll('.hud-top .tools .g-btn')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => [b.innerText.trim(), b])) };
      const covered = Object.entries(parts).filter(([, el]) => { if (!el) return false; const b = box(el); return !(n.right <= b.left || n.left >= b.right || n.bottom <= b.top || n.top >= b.bottom); }).map(([k]) => k);
      const pressable = [...document.querySelectorAll('.w-nudge button')].every((b) => { const x = b.getBoundingClientRect(), at = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return !!at && b.contains(at); });
      return { top: Math.round(n.top), bottom: Math.round(n.bottom), covered, pressable, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    ok(`${label}: backup nudge covers no HUD part, joystick or gestures (review 6)`, !r.covered.length && r.pressable && r.overflow <= 0, r);
    await p.screenshot({ path: `${out}/6-nudge-${label.replace(/\s+/g, '-')}.png` }); await ctx.close();
  }

  // ── 지적 7·10: 좁은 iPhone의 저장 안내가 화면 안에 들고 [닫기]로 닫히며, 초점이 연 단추로 돌아온다 ──
  for (const dev of ['iPhone SE', 'iPhone 8', 'iPhone 13']) {
    const { ctx, p } = await page({ ...devices[dev] });
    await p.goto(URL0); await startWorld(p);
    await p.getByRole('button', { name: '사진 고르기', exact: true }).click();
    const gate = p.getByRole('dialog', { name: '홈 화면에 추가하기' }); await gate.waitFor(); await gate.getByRole('button', { name: '추가하는 방법' }).click();
    const r = await p.evaluate(() => { const c = document.querySelector('.w-gate').getBoundingClientRect(); return { width: innerWidth, inside: c.left >= 0 && c.right <= innerWidth && [...document.querySelectorAll('.w-gate button')].every((b) => { const x = b.getBoundingClientRect(); return x.left >= 0 && x.right <= innerWidth; }) }; });
    await gate.getByRole('button', { name: '닫기' }).click(); await gate.waitFor({ state: 'detached' }); await p.waitForTimeout(200);
    const focus = await p.evaluate(() => document.activeElement?.innerText?.trim());
    ok(`${dev}: storage guide fits, closes with [닫기], focus back on [사진 고르기] (review 7)`, r.inside && focus === '사진 고르기', { ...r, focus });
    if (dev === 'iPhone 13') {
      // [작품 올리기] → 저장 안내 → [그래도 여기서 올리기] → 올리기 창을 닫으면 초점이 [작품 올리기]로
      await p.getByRole('button', { name: '작품 올리기', exact: true }).click(); await gate.waitFor();
      await gate.getByRole('button', { name: '그래도 여기서 올리기' }).click();
      const upload = p.getByRole('dialog', { name: '작품 올리기' }); await upload.waitFor(); await upload.getByRole('button', { name: '닫기' }).click(); await upload.waitFor({ state: 'detached' }); await p.waitForTimeout(200);
      const back = await p.evaluate(() => document.activeElement?.innerText?.trim());
      ok('upload window opened through the storage guide returns focus to [작품 올리기] (review 10)', back === '작품 올리기', { back });
    }
    await ctx.close();
  }

  // ── 지적 9: 새로 고치지 않고 화면이 다시 보일 때, 날이 바뀌었으면 들어온 날을 한 번 센다 ──
  {
    const { ctx, p } = await page();
    await p.goto(URL0); await startWorld(p); await p.waitForTimeout(500);
    const days = async () => (await p.evaluate(async (s) => (await import(s)).getUsageRecord(), STORE))?.days ?? null;
    const d0 = await days(); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(300); const same = await days();
    await p.evaluate(() => { const D = Date, shift = 86400000; class F extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + shift); } static now() { return D.now() + shift; } } window.Date = F; });
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(500); const next = await days();
    await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await p.waitForTimeout(300); const again = await days();
    ok('returning without reload counts a new day once (review 9)', d0 === 1 && same === 1 && next === 2 && again === 2, { d0, same, next, again });
    await ctx.close();
  }

  // ── 지적 10: 묻던 작품이 지워졌으면 주제 단추가 다음(끝)으로 넘어간다 ──
  {
    const { ctx, p } = await page();
    await p.goto(URL0); await startWorld(p); await uploadFirst(p, await images(p, 2)); await settled(p); await p.waitForTimeout(800);
    await p.getByRole('button', { name: '건너뛰기' }).click();
    await p.evaluate(async (s) => { const st = await import(s), l = (await st.listArtworks()).filter((a) => !a.sample); await st.deleteArtwork(l.at(-1).id); }, STORE);
    await p.getByRole('button', { name: /호랑이/ }).click(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /로켓/ }).click(); await p.waitForTimeout(500);
    ok('a subject button for a deleted work moves on instead of doing nothing (review 10)', await card(p).getByRole('button', { name: '움직여 보기' }).isVisible().catch(() => false));
    await ctx.close();
  }

  // ── 지적 10: 3D가 없는 기기도 앱을 열 때 들어온 날을 세고, 처리 전 작품을 이어서 한다 ──
  {
    const flat = await chromium.launch({ channel: process.env.WORLD_REVIEW_GPU === '1' ? 'chrome' : undefined, args: ['--disable-webgl', '--disable-3d-apis'] });
    const ctx = await flat.newContext({ viewport: { width: 1280, height: 800 } }), p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(URL0); await p.locator('.fallback').waitFor({ timeout: 60000 }); await p.waitForTimeout(800);
    const days = (await p.evaluate(async (s) => (await import(s)).getUsageRecord(), STORE))?.days ?? null;
    await p.getByRole('button', { name: '작품 올리기' }).first().click();
    const fc = p.waitForEvent('filechooser'); await p.getByRole('button', { name: '앨범에서 고르기' }).click(); await (await fc).setFiles(await images(p, 1));
    await p.waitForTimeout(3000);
    await p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('uam-world'); r.onsuccess = () => { const t = r.result.transaction('artworks', 'readwrite'), s = t.objectStore('artworks'), g = s.getAll(); g.onsuccess = () => { for (const a of g.result) if (!a.sample) s.put({ ...a, cutout: null, cutoutState: 'pending' }); }; t.oncomplete = () => res(); t.onerror = () => rej(t.error); }; }));
    await p.reload(); await p.locator('.fallback').waitFor({ timeout: 60000 });
    let states = []; for (let i = 0; i < 80; i++) { states = await p.evaluate(async (s) => (await (await import(s)).listArtworks()).filter((a) => !a.sample).map((a) => a.cutoutState), STORE); if (states.length && states.every((x) => x !== 'pending')) break; await p.waitForTimeout(100); }
    ok('without 3D the overview counts the visit and resumes pending background removal (review 10)', days === 1 && states.length === 1 && states.every((x) => x !== 'pending'), { days, states });
    await ctx.close(); await flat.close();
  }

  ok('no page or console errors', errors.length === 0, errors.slice(0, 5));
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
const failed = results.filter((r) => !r.pass).length;
console.log(`${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
