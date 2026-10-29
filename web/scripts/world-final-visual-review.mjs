// §2-14 마지막 시각 보정의 같은 카메라 화면. 보정 직전 코드와 보정 뒤 코드에서 같은 명령으로 한 번씩 찍는다.
// 실제 배율은 1로 고정한다(검사에서만 고정, 엔진의 동적 화질 코드는 그대로).
// 하드웨어 렌더러 강제는 reviewBrowser()가 WORLD_REVIEW_GPU=1일 때만 한다. 이 값이 없으면 SwiftShader로 실행되므로 반드시 붙인다.
// 실행: (web의 개발 서버가 127.0.0.1:5173에 떠 있을 때) WORLD_REVIEW_GPU=1 node web/scripts/world-final-visual-review.mjs <증거 폴더>
import { reviewBrowser } from './review-browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const out = path.resolve(process.argv[2] ?? '../_claude/검증/20261021-claude-rework/final-visual');
const webDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
fs.mkdirSync(out, { recursive: true });
const files = ['avatar.ts', 'themes.ts', 'outdoor.ts', 'museum.ts', 'behaviors.ts', 'engine.ts', 'WorldView.vue', 'store.ts'].map(f => `src/app/world/${f}`).concat(['scripts/world-final-visual-review.mjs']);
const result = { started: new Date().toISOString(), sourceHashes: Object.fromEntries(files.map(f => [f, createHash('sha256').update(fs.readFileSync(path.join(webDir, f))).digest('hex')])), shots: [], checks: {}, errors: [] };
const save = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
const browser = await reviewBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', e => result.errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/app/world');
  await page.getByRole('button', { name: '테스트 계정으로 들어가기' }).click();
  await page.waitForFunction(() => window.__uamWorld?.debugState().works === 14, null, { timeout: 90000 });
  result.renderer = await page.evaluate(async () => {
    const e = window.__uamWorld, gl = e.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    await e.loadDecor(); e.skipIntro(); e.setInputPaused(true);
    e.adapt = () => {}; e.renderer.setPixelRatio(1); e.resize();
    e.updateCamera = () => {};
    await e.setAvatar((await import('/src/app/world/avatar.ts')).DEFAULT_AVATAR, null);
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
  const shot = async (name, setup) => {
    await page.evaluate(setup);
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({ ratio: window.__uamWorld.renderer.getPixelRatio(), post: !!window.__uamWorld.postReady(), theme: window.__uamWorld.theme.current, space: window.__uamWorld.space }));
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    result.shots.push({ name, ...state }); save();
  };
  const plaza = () => { const e = window.__uamWorld; e.showPlaza(); e.skipIntro(); e.avatarRoot.position.set(0, 0, 28); e.avatarRoot.rotation.y = 0; };
  await shot('plaza-wide', () => { const e = window.__uamWorld; e.setTheme('classic'); e.showPlaza(); e.skipIntro(); e.avatarRoot.position.set(0, 0, 28); e.camera.position.set(24, 18, 48); e.camera.lookAt(0, 3, 13); });
  await shot('plaza-front', () => { const e = window.__uamWorld; e.camera.position.set(0, 3.2, 26); e.camera.lookAt(0, 4, 6); });
  for (const deg of [0, 45, 90]) await shot(`avatar-basic-${deg}`, `(${plaza.toString()})();{const e=window.__uamWorld,a=${deg}*Math.PI/180;e.camera.position.set(Math.sin(a)*3,1.15,28+Math.cos(a)*3);e.camera.lookAt(0,.8,28);}`);
  await shot('lobby', () => { const e = window.__uamWorld; e.enterMuseum(); e.camera.position.set(7, 4, 9); e.camera.lookAt(-1, 4, -7); });
  await shot('lobby-overview', () => { const e = window.__uamWorld; e.camera.position.set(4, 5, 10.5); e.camera.lookAt(0, 7, -24); });
  await shot('room', () => { const e = window.__uamWorld, r = e.museum.rooms[0]; e.camera.position.set(r.side * 6.2, 2, r.cz + 4.2); e.camera.lookAt(r.side * 14, 3.2, r.cz - 3); });

  // 얼굴이 머리 밖으로 나온 거리(머리 반지름 대비, 클래식 기본 캐릭터), 현수막 작품 면의 크기와 원본 비율
  result.checks = await page.evaluate(() => {
    const e = window.__uamWorld, head = e.rig.root.getObjectByName('basic-head'), r = head.scale.x / 2;
    let face = null; head.parent.children.forEach(c => { if (c !== head && c.isMesh && c.material?.map) face = c; });
    let maxOut = 0; const p = face.geometry.attributes.position, v = new (e.camera.position.constructor)();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(face.matrix); maxOut = Math.max(maxOut, v.length() - r); }
    e.showPlaza(); e.skipIntro();
    const art = []; e.outdoor.buildings.traverse(o => { if (o.name === 'artwork-banner') { o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.max.clone().sub(o.geometry.boundingBox.min); const img = o.material.map.image; art.push({ w: +s.x.toFixed(3), h: +s.y.toFixed(3), planeAspect: +(s.x / s.y).toFixed(4), imageAspect: +(img.width / img.height).toFixed(4) }); } });
    return { headRadius: r, faceMaxOutsideHead: +maxOut.toFixed(4), faceVertices: p.count, banners: art };
  });
  // 모드 4종: 현수막은 클래식 내 건물에만, 셰이더 수가 두 번째 순환에서 늘지 않음
  const modes = [];
  for (const round of [1, 2]) for (const m of ['classic', 'block', 'forest', 'toy']) {
    await page.evaluate(m => { const e = window.__uamWorld; e.setTheme(m); e.showPlaza(); e.skipIntro(); e.camera.position.set(24, 18, 48); e.camera.lookAt(0, 3, 13); }, m);
    await page.waitForTimeout(800);
    if (round === 1) await page.screenshot({ path: path.join(out, `mode-${m}.png`) });
    modes.push({ round, mode: m, programs: await page.evaluate(() => window.__uamWorld.renderer.info.programs.length), banners: await page.evaluate(() => { let n = 0; window.__uamWorld.outdoor.buildings.traverse(o => { if (o.name === 'artwork-banner') n++; }); return n; }) });
  }
  result.checks.modes = modes;
  result.checks.programsStable = Math.max(...modes.filter(r => r.round === 2).map(r => r.programs)) <= Math.max(...modes.filter(r => r.round === 1).map(r => r.programs));
  result.checks.bannerOnlyClassic = modes.every(r => r.banners === (r.mode === 'classic' ? 2 : 0));
  await page.close();
} catch (e) { result.errors.push(String(e.stack ?? e)); }
finally { await browser.close(); result.finished = new Date().toISOString(); save(); console.log(JSON.stringify({ renderer: result.renderer, checks: result.checks, errors: result.errors }, null, 2)); }
if (result.errors.length || !result.checks.programsStable || !result.checks.bannerOnlyClassic) process.exitCode = 1;
