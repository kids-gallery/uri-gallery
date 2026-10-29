// §2-14 원본이 주인공인 전시·하나의 미술 방향·가까이 감상의 행동 검사와 같은 카메라 화면.
// 팀 견본과 합성 SVG만 쓴다. 기본 실행은 SwiftShader, WORLD_REVIEW_GPU=1이면 설치된 Chrome의 하드웨어 렌더러만 허용한다.
import { reviewBrowser, startWorld, tool } from './review-browser.mjs';
import fs from 'node:fs';

const out = process.argv[2] ?? '../_claude/검증/20261021-claude-rework/rework';
const url = process.env.WORLD_URL ?? 'http://127.0.0.1:5173/app/world';
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [];
const ok = (name, pass, detail) => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}`); };
// 결함 후보 확인: 결과를 그대로 기록하고 실패(종료 1)로 센다
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="white"/><circle cx="200" cy="150" r="95" fill="#e8a035"/></svg>';

async function enter(page) {
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.getByRole('button', { name: '테스트 계정으로 들어가기' }).click();
  await page.waitForFunction(() => window.__uamWorld?.debugState().works >= 14, null, { timeout: 90000 });
  await page.evaluate(() => window.__uamWorld.skipIntro());
}
const hashOf = (page, expr) => page.evaluate(async expr => {
  const blob = await (new Function('return (async()=>' + expr + ')()'))();
  const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}, expr);
const banners = page => page.evaluate(() => { let n = 0; window.__uamWorld.outdoor.buildings.traverse(o => { if (o.name === 'artwork-banner') n++; }); return n; });

const browser = await reviewBrowser();
try {
  // ── 1. 원본이 주인공인 전시 ──
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await enter(page);
  ok('server serves the modified tree (featured state exists)', await page.evaluate(() => 'featured' in window.__uamWorld.debugState()));
  await page.evaluate(() => window.__uamWorld.enterMuseum());
  await page.waitForFunction(() => window.__uamWorld.debugState().space === 'inside');
  const display = await page.evaluate(() => {
    const e = window.__uamWorld, rows = [];
    for (const w of e.museum.works.values()) { const print = w.group.getObjectByName('original-print'); rows.push({ id: w.id, wall: !!print, print: print?.visible ?? null, relief: w.relief.visible }); }
    return rows;
  });
  ok('wall works show the original print and hide the relief', display.filter(r => r.wall).every(r => r.print && !r.relief), display.filter(r => r.wall).length);
  ok('pedestal works keep the standing relief', display.filter(r => !r.wall).every(r => r.relief), display.filter(r => !r.wall).length);
  const wallId = display.find(r => r.wall).id, pedId = display.find(r => !r.wall)?.id;
  await page.evaluate(id => window.__uamWorld.play(id), wallId);
  const during = await page.evaluate(id => ({ playing: window.__uamWorld.debugState().playing, print: window.__uamWorld.museum.works.get(id).group.getObjectByName('original-print').visible }), wallId);
  ok('relief leaves the frame while the original stays', during.playing === 1 && during.print, during);
  // 움직임 길이는 게임 시간 7초다(느린 프레임에서는 한 프레임 최대 0.1초만 흐른다). 실제 시간 대신 끝날 때까지 기다린다
  await page.waitForFunction(() => window.__uamWorld.debugState().playing === 0, null, { timeout: 90000 });
  ok('after the performance the wall relief hides again', await page.evaluate(id => { const e = window.__uamWorld, w = e.museum.works.get(id); return !w.relief.visible && w.group.getObjectByName('original-print').visible; }, wallId));
  if (pedId) { await page.evaluate(id => window.__uamWorld.play(id), pedId); await page.waitForFunction(() => window.__uamWorld.debugState().playing === 0, null, { timeout: 90000 }); ok('after the performance the pedestal relief is visible again', await page.evaluate(id => window.__uamWorld.museum.works.get(id).relief.visible, pedId)); }
  const latest = await page.evaluate(() => [...window.__uamWorld.artworks.values()].sort((a, b) => b.createdAt - a.createdAt)[0].id);
  ok('default featured work is the latest work', await page.evaluate(() => window.__uamWorld.debugState().featured) === latest);

  // 모드 순환: 클래식에서만 현수막 2장, 셰이더 수 두 번째 순환에서 늘지 않음
  const modes = [];
  for (const round of [1, 2]) for (const m of ['classic', 'block', 'forest', 'toy']) {
    await page.evaluate(m => { const e = window.__uamWorld; e.setTheme(m); e.showPlaza(); e.skipIntro(); }, m);
    await page.waitForTimeout(400);
    modes.push({ round, mode: m, banners: await banners(page), programs: await page.evaluate(() => window.__uamWorld.renderer.info.programs.length) });
  }
  ok('banner only on my classic building', modes.every(r => r.banners === (r.mode === 'classic' ? 2 : 0)), modes);
  const p1 = Math.max(...modes.filter(r => r.round === 1).map(r => r.programs)), p2 = Math.max(...modes.filter(r => r.round === 2).map(r => r.programs));
  ok('shader programs do not grow on the second mode cycle', p2 <= p1, { first: p1, second: p2 });
  await page.evaluate(() => { const e = window.__uamWorld; e.setTheme('classic'); e.showPlaza(); e.skipIntro(); });

  // 결함 후보 A: 친구 미술관 방문 직전 광장 재구성에서 내 현수막이 남는가(visitSelected와 같은 순서)
  const ownId = await page.evaluate(() => window.__uamWorld.ownBuilding.id);
  const visitBanner = await page.evaluate(() => { const e = window.__uamWorld; e.setBuilding('column_temple', '친구', 'friend'); e.showPlaza(); let n = 0; e.outdoor.buildings.traverse(o => { if (o.name === 'artwork-banner') n++; }); return n; });
  ok('[candidate A] friend building is not shown with my banner before the visit loads', visitBanner === 0, { bannersOnFriendBuilding: visitBanner });
  await page.evaluate(id => { const e = window.__uamWorld; e.setBuilding('column_temple', '하늘', id); e.showPlaza(); e.skipIntro(); }, ownId);
  ok('my own building gets its banner back after the visit sequence', await banners(page) === 2);

  // 결함 후보 B: 공개 대기 중 밖으로 나가면 다음 입장에서 지난 공개가 실행되는가
  const other = await page.evaluate(l => [...window.__uamWorld.artworks.values()].find(a => a.id !== l).id, latest);
  await page.evaluate(id => window.__uamWorld.setFeaturedId(id), other);
  const stale = await page.evaluate(async l => {
    const e = window.__uamWorld; e.reduced = false; e.showPlaza(); e.skipIntro(); e.reveal(l); e.showPlaza(); e.skipIntro();
    const pending = { afterReveal: e.afterReveal, faceAfterRoute: e.faceAfterRoute };
    e.reduced = true; e.enterMuseum();
    await new Promise(r => setTimeout(r, 600));
    return { pending, featuredAfterPlainEntry: e.debugState().featured };
  }, latest);
  ok('[candidate B] leaving during a pending reveal does not replay it on the next entry', stale.featuredAfterPlainEntry === other && !stale.pending.afterReveal, stale);
  await page.evaluate(() => { const e = window.__uamWorld; e.setFeaturedId(null); e.showPlaza(); e.skipIntro(); });

  // 대표작 고르기(UI) → 새로고침 유지 → 로비·현수막 반영
  await page.evaluate(() => { const e = window.__uamWorld; e.enterMuseum(); });
  await page.waitForFunction(() => window.__uamWorld.debugState().space === 'inside');
  await page.evaluate(id => { const e = window.__uamWorld, w = e.museum.works.get(id); e.debugTeleport(w.stand.x, w.stand.z); }, wallId);
  await page.waitForSelector('.plaque');
  await page.getByRole('button', { name: '대표작으로 걸기' }).click();
  await page.waitForFunction(id => window.__uamWorld.debugState().featured === id, wallId);
  await page.reload(); await startWorld(page);
  await page.waitForFunction(() => window.__uamWorld?.debugState().works >= 14, null, { timeout: 90000 });
  ok('chosen featured work persists after reload', await page.evaluate(() => window.__uamWorld.debugState().featured) === wallId);

  // ── 3. 가까이 보기와 이야기 ──
  await page.evaluate(() => { const e = window.__uamWorld; e.skipIntro(); e.enterMuseum(); });
  await page.waitForFunction(() => window.__uamWorld.debugState().space === 'inside');
  await page.evaluate(id => { const e = window.__uamWorld, w = e.museum.works.get(id); e.debugTeleport(w.stand.x, w.stand.z); }, wallId);
  await page.waitForSelector('.plaque');
  const originalBefore = await hashOf(page, `(await (await import('/src/app/world/store.ts')).listArtworks()).find(a=>a.id==='${wallId}').original`);
  const displayHash = await hashOf(page, `(await (await import('/src/app/world/store.ts')).listArtworks()).find(a=>a.id==='${wallId}').display`);
  await page.getByRole('button', { name: '가까이 보기' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const shownHash = await hashOf(page, `await (await fetch(document.querySelector('.w-view-figure img').src)).blob()`);
  ok('close view shows the stored display copy byte for byte', shownHash === displayHash);
  await page.screenshot({ path: `${out}/view-desktop.png` });
  let trapped = true;
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); trapped = trapped && await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')); }
  ok('Tab stays inside the close view', trapped);
  await page.locator('.w-story textarea').fill('ㄱ'.repeat(250));
  ok('story is limited to 200 characters', (await page.locator('.w-story textarea').inputValue()).length === 200);
  await page.locator('.w-story textarea').fill('엄마랑 달에 갈 거야');
  await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...a) { if (this.name === 'artworks') throw new DOMException('quota', 'QuotaExceededError'); return window.__put.apply(this, a); }; });
  await page.getByRole('button', { name: '이야기 남기기' }).click();
  await page.getByText('저장하지 못했어요. 적은 내용은 남아 있어요').waitFor();
  ok('failed story save keeps the typed text', await page.locator('.w-story textarea').inputValue() === '엄마랑 달에 갈 거야');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
  await page.getByRole('button', { name: '이야기 남기기' }).click();
  await page.getByText('이야기를 남겼어요').waitFor();
  const originalAfter = await hashOf(page, `(await (await import('/src/app/world/store.ts')).listArtworks()).find(a=>a.id==='${wallId}').original`);
  ok('original blob is unchanged after the story save', originalAfter === originalBefore, { originalBefore, originalAfter });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  const focusAfter = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim() ?? '', tag: document.activeElement?.tagName }));
  ok('[candidate C] closing returns focus to the close-view button', /가까이 보기/.test(focusAfter.text), focusAfter);
  await page.reload(); await startWorld(page);
  await page.waitForFunction(() => window.__uamWorld?.debugState().works >= 14, null, { timeout: 90000 });
  ok('story persists after reload', await page.evaluate(async id => (await (await import('/src/app/world/store.ts')).listArtworks()).find(a => a.id === id).words, wallId) === '엄마랑 달에 갈 거야');

  // 삭제 경계: 대표작 삭제 → 최근 작품으로, 전부 삭제 → 대표작·현수막 없음
  await page.evaluate(async id => { await (await import('/src/app/world/store.ts')).deleteArtwork(id); }, wallId);
  await page.reload(); await startWorld(page);
  await page.waitForFunction(() => window.__uamWorld?.debugState().works >= 13, null, { timeout: 90000 });
  const afterDelete = await page.evaluate(() => { const e = window.__uamWorld; return { featured: e.debugState().featured, latest: [...e.artworks.values()].sort((a, b) => b.createdAt - a.createdAt)[0].id }; });
  ok('deleting the featured work falls back to the latest work', afterDelete.featured === afterDelete.latest, afterDelete);
  await page.evaluate(async () => { const s = await import('/src/app/world/store.ts'); for (const a of await s.listArtworks()) await s.deleteArtwork(a.id); });
  await page.reload(); await startWorld(page);
  await page.waitForFunction(() => window.__uamWorld?.renderer.info.render.frame > 0, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const empty = await page.evaluate(() => { const e = window.__uamWorld; let b = 0; e.outdoor.buildings.traverse(o => { if (o.name === 'artwork-banner') b++; }); return { works: e.debugState().works, featured: e.debugState().featured, banners: b, featuredPickables: e.museum.pickables.filter(o => o.userData.featured && o.userData.workId).length, placeholder: e.museum.pickables.filter(o => o.userData.action === 'firstWork').length }; });
  // §2-23: 로비에는 작품을 걸지 않는다. 빈 대표작 자리도 없고, 첫 작품은 화면의 안내 카드로 올린다
  ok('with no works there is no featured artwork, banner, stale pick target or lobby placeholder (§2-23)', empty.works === 0 && empty.featured === null && empty.banners === 0 && empty.featuredPickables === 0 && empty.placeholder === 0, empty);
  ok('desktop page errors', errors.length === 0, errors.slice());
  await page.close();

  // 가족 전환: 새 가족은 자기 최근 작품을 대표작으로 쓴다
  const fam = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await enter(fam);
  const firstFamilyLatest = await fam.evaluate(() => window.__uamWorld.debugState().featured);
  await tool(fam, '설정');
  await fam.getByRole('button', { name: '테스트 가족 추가' }).click();
  await fam.waitForFunction(() => document.body.innerText.includes('새 가족 2의 미술관'), null, { timeout: 90000 });
  // 새 가족의 견본을 다 불러올 때까지 기다린다(첫 가족 값이 끝내 남으면 아래 확인이 실패한다)
  await fam.waitForFunction(first => window.__uamWorld?.debugState().works >= 14 && window.__uamWorld.debugState().featured !== first, firstFamilyLatest, { timeout: 90000 }).catch(() => {});
  const second = await fam.evaluate(() => { const e = window.__uamWorld; return { featured: e.debugState().featured, latest: [...e.artworks.values()].sort((a, b) => b.createdAt - a.createdAt)[0].id }; });
  ok('family switch uses the new family\'s own featured work', second.featured === second.latest && second.featured !== firstFamilyLatest, second);
  await fam.close();

  // ── 공개 흐름: 새 작품 저장 → 미술관에서 만나기 ──
  const rev = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await enter(rev);
  // §2-15·§2-23: 사진을 고르면 묻지 않고 보관하고, 흰빛 전환으로 그 전시관의 작품 앞에 선다(만나기 버튼 없음). 대표작은 광장 현수막에만 쓴다
  await rev.getByRole('button', { name: '작품 올리기', exact: true }).click();
  await rev.locator('input[type=file]').first().setInputFiles({ name: 'memory.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  await rev.locator('.w-saved').waitFor({ timeout: 60000 });
  const newest = await rev.evaluate(() => [...window.__uamWorld.artworks.values()].sort((a, b) => b.createdAt - a.createdAt)[0].id);
  await rev.waitForFunction(id => window.__uamWorld.debugState().space === 'inside' && window.__uamWorld.debugState().featured === id, newest, { timeout: 30000 });
  await rev.waitForFunction(() => !window.__uamWorld.route.length, null, { timeout: 30000 });
  await rev.waitForTimeout(700);
  await rev.screenshot({ path: `${out}/reveal-glow.png` });
  await rev.waitForTimeout(2500);
  const area = await rev.evaluate((id) => {
    const e = window.__uamWorld, THREE = e.camera.position.constructor, box = { minX: 1, minY: 1, maxX: -1, maxY: -1 };
    const print = e.museum.works.get(id).group.getObjectByName('original-print'); print.updateWorldMatrix(true, false);
    const p = print.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(print.matrixWorld).project(e.camera); box.minX = Math.min(box.minX, v.x); box.maxX = Math.max(box.maxX, v.x); box.minY = Math.min(box.minY, v.y); box.maxY = Math.max(box.maxY, v.y); }
    const clip = (a) => Math.max(-1, Math.min(1, a));
    return { screenFraction: ((clip(box.maxX) - clip(box.minX)) * (clip(box.maxY) - clip(box.minY))) / 4, avatar: e.debugState(), revealFocus: e.revealFocus };
  }, newest);
  await rev.screenshot({ path: `${out}/reveal-settled.png` });
  ok('reveal stands in front of the new work with it on screen', area.screenFraction > 0.03, area);
  ok('reveal page errors', errors.length === 0, errors.slice());
  await rev.close();

  // ── 390px 가까이 보기 ──
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await enter(mobile);
  await mobile.evaluate(() => { const e = window.__uamWorld; e.enterMuseum(); });
  await mobile.waitForFunction(() => window.__uamWorld.debugState().space === 'inside');
  await mobile.evaluate(() => { const e = window.__uamWorld, w = [...e.museum.works.values()].find(w => w.group.getObjectByName('original-print')); e.debugTeleport(w.stand.x, w.stand.z); });
  await mobile.waitForSelector('.plaque');
  await mobile.getByRole('button', { name: '가까이 보기' }).click();
  await mobile.getByRole('dialog').waitFor();
  ok('390px close view has no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  ok('390px save and close buttons are reachable', await mobile.getByRole('button', { name: '닫기', exact: true }).isVisible());
  await mobile.screenshot({ path: `${out}/view-390.png` });
  await mobile.close();

  // ── 친구 방문: 가까이 보기에는 원본만, 이야기·편집·대표작 고르기는 없음 ──
  const vp = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await enter(vp);
  await tool(vp, '친구 초대'); await vp.getByRole('button', { name: '친구 초대 링크 만들기' }).click();
  const link = await vp.locator('.w-link').inputValue(); await vp.getByRole('button', { name: '닫기', exact: true }).click();
  await tool(vp, '설정'); await vp.getByRole('button', { name: '테스트 가족 추가' }).click();
  await vp.waitForFunction(() => document.body.innerText.includes('새 가족 2의 미술관'), null, { timeout: 90000 });
  await vp.goto(link); await startWorld(vp); await vp.getByRole('button', { name: '친구 되기', exact: true }).click();
  await vp.waitForFunction(() => window.__uamWorld?.debugState().space === 'town');
  await vp.getByRole('button', { name: '들어가기', exact: true }).click();
  await vp.waitForFunction(() => window.__uamWorld?.debugState().space === 'inside', null, { timeout: 90000 });
  ok('no banner is kept while visiting a friend', await vp.evaluate(() => window.__uamWorld.outdoor.banner === null));
  await vp.evaluate(() => { const e = window.__uamWorld, w = [...e.museum.works.values()].find(w => w.group.getObjectByName('original-print')); e.debugTeleport(w.stand.x, w.stand.z); });
  await vp.waitForSelector('.plaque');
  ok('visitor plaque has no featured-work control', !(await vp.getByRole('button', { name: '대표작으로 걸기' }).count()));
  await vp.getByRole('button', { name: '가까이 보기' }).click();
  await vp.getByRole('dialog').waitFor();
  ok('visitor close view has no story field or save button', !(await vp.locator('.w-story textarea').count()) && !(await vp.getByRole('button', { name: '이야기 남기기' }).count()));
  await vp.screenshot({ path: `${out}/view-visitor.png` });
  ok('visitor page errors', errors.length === 0, errors.slice());
  await vp.close();

  // ── 클래식 기본 캐릭터 45° 화면과 현재 규격(무광, 머리 0.52) 확인. 기준선 몸과의 비교는 하지 않는다 ──
  const av = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await enter(av);
  await av.evaluate(() => { const e = window.__uamWorld; e.setTheme('classic'); e.showPlaza(); e.skipIntro(); e.updateCamera = () => {}; e.setInputPaused(true); e.avatarRoot.position.set(0, 0, 28); e.avatarRoot.rotation.y = 0; const a = Math.PI / 4; e.camera.position.set(Math.sin(a) * 3, 1.15, 28 + Math.cos(a) * 3); e.camera.lookAt(0, .8, 28); });
  await av.waitForTimeout(800);
  await av.screenshot({ path: `${out}/avatar-basic-45.png` });
  const avatarSpec = await av.evaluate(() => { const e = window.__uamWorld, head = e.rig.root.getObjectByName('basic-head'); const mats = []; e.rig.root.traverse(o => { if (o.isMesh && o.material?.metalness !== undefined) mats.push(o.material.metalness); }); return { head: head.scale.x, maxMetalness: Math.max(...mats) }; });
  ok('classic basic avatar matches the current spec: matte, head 0.52', avatarSpec.maxMetalness === 0 && Math.abs(avatarSpec.head - 0.52) < 1e-6, avatarSpec);
  await av.close();
} catch (e) { ok('exception', false, String(e.stack ?? e)); }
finally {
  await browser.close();
  fs.writeFileSync(`${out}/result.json`, JSON.stringify({ url, results, errors }, null, 2));
}
if (results.some(r => !r.pass)) process.exitCode = 1;
