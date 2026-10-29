// Behavior checks for keyboard camera and discoverable mobile help; no performance claims.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { startWorld } from './review-browser.mjs';
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const results = [], ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name); };
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:5173/app/world');
    await page.getByRole('button', { name: '테스트 계정으로 들어가기' }).click();
    await page.waitForFunction(() => window.__uamWorld?.debugState().works === 14, null, { timeout: 90000 });
    await page.evaluate(() => { window.__uamWorld.skipIntro(); document.activeElement?.blur(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'desktop'}-entry.png` });
    if (!mobile) {
      const before = await page.evaluate(() => window.__uamWorld.yaw);
      await page.keyboard.down('KeyL'); await page.waitForTimeout(450); await page.keyboard.up('KeyL');
      const turned = await page.evaluate(() => window.__uamWorld.yaw);
      ok('keyboard rotates view', Math.abs(turned - before) > .1, { before, turned });
      await page.screenshot({ path: `${out}/keyboard-turn.png` });
      await page.keyboard.press('KeyR'); await page.waitForTimeout(500);
      ok('keyboard restores view', await page.evaluate(() => Math.abs(window.__uamWorld.yaw) < .01));
      const d = await page.evaluate(() => window.__uamWorld.dist);
      await page.keyboard.down('Equal'); await page.waitForTimeout(300); await page.keyboard.up('Equal');
      ok('keyboard zooms', await page.evaluate(d => window.__uamWorld.dist < d, d));
      await page.keyboard.down('KeyL'); await page.waitForTimeout(100);
      await page.evaluate(() => dispatchEvent(new Event('blur')));
      const stopped = await page.evaluate(() => window.__uamWorld.yaw);
      await page.waitForTimeout(200); await page.keyboard.up('KeyL');
      ok('blur stops held camera key', await page.evaluate(y => Math.abs(window.__uamWorld.yaw - y) < .001, stopped));
      await page.evaluate(() => { const input = document.createElement('input'); input.id = 'review-input'; document.body.append(input); input.focus(); });
      const editing = await page.evaluate(() => window.__uamWorld.yaw);
      await page.keyboard.down('KeyL'); await page.waitForTimeout(100); await page.keyboard.up('KeyL');
      ok('typing leaves camera unchanged', await page.evaluate(y => window.__uamWorld.yaw === y, editing));
      await page.evaluate(() => document.querySelector('#review-input').remove());
    } else {
      ok('mobile first-use help visible', await page.locator('.w-first-help').isVisible().catch(() => false));
      const dismiss = page.locator('.w-first-help').getByRole('button', { name: '닫기', exact: true });
      if (await dismiss.count()) {
        const tip = await page.locator('.w-first-help').boundingBox(), joystick = await page.locator('.joy').boundingBox();
        ok('tip leaves joystick clear', tip.y + tip.height <= joystick.y);
        await dismiss.click(); ok('first-use tip dismisses', !(await page.locator('.w-first-help').count()));
        await page.reload(); await startWorld(page); await page.waitForFunction(() => window.__uamWorld?.debugState().works === 14);
        ok('dismissal remembered in this tab', !(await page.locator('.w-first-help').count()));
      }
    }
    // 사용법은 [더보기] 안에 있다(3D미술관_재설계 §2-17)
    await page.getByRole('button', { name: '더보기', exact: true }).click();
    const help = page.getByRole('button', { name: '사용법', exact: true });
    ok('help can be reopened', await help.count() === 1);
    if (await help.count()) {
      await help.click();
      const box = page.getByRole('dialog', { name: '미술관 사용법' });
      await box.waitFor();
      ok('help describes device controls', (await box.innerText()).includes(mobile ? '두 손가락' : 'I J K L'));
      const yaw = await page.evaluate(() => window.__uamWorld.yaw);
      await page.keyboard.press('KeyL');
      ok('modal pauses camera keys', await page.evaluate(y => window.__uamWorld.yaw === y, yaw));
      const controls = box.getByRole('button'); await controls.last().focus(); await page.keyboard.press('Tab');
      ok('help traps focus', await controls.first().evaluate(el => el === document.activeElement));
      ok('help fits viewport', await box.evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'desktop'}-help.png` });
      await page.keyboard.press('Escape');
      ok('Escape restores trigger focus', await help.evaluate(el => el === document.activeElement));
    }
    if (mobile) {
      await page.getByRole('button', { name: '작품 올리기', exact: true }).click();
      await page.getByRole('button', { name: '사진 찍기', exact: true }).waitFor();
      await page.screenshot({ path: `${out}/capture-entry.png` });
      ok('camera entry preserved', await page.locator('input[capture]').getAttribute('capture') === 'environment');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '함께 놀기', exact: true }).click();
      await page.getByRole('button', { name: /함께 그리기/ }).waitFor();
      await page.screenshot({ path: `${out}/play-menu.png` });
      await page.keyboard.press('Escape');
    }
    ok('no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('no page errors', !errors.length, errors);
    await page.close();
  }
  const blocked = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await blocked.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('disabled', 'SecurityError'); } }));
  await blocked.goto('http://127.0.0.1:5173/app/world');
  await blocked.getByRole('button', { name: '테스트 계정으로 들어가기' }).click();
  await blocked.waitForFunction(() => window.__uamWorld?.debugState().works === 14);
  await blocked.locator('.w-first-help').getByRole('button', { name: '닫기', exact: true }).click();
  ok('blocked sessionStorage still allows dismissal', !(await blocked.locator('.w-first-help').count()));
  ok('blocked sessionStorage preserves family isolation', await blocked.evaluate(async () => {
    const s = await import('/src/app/world/store.ts'), original = await s.getAccount();
    await s.saveAccount({ ...original, id: 'blocked-other', child: '별도 견본' });
    await s.selectFamily('blocked-other'); const empty = (await s.listArtworks()).length === 0;
    await s.selectFamily(original.id); return empty && (await s.listArtworks()).length === 14;
  }));
  await blocked.close();
} catch (e) { ok('exception', false, String(e.stack ?? e)); }
finally { await browser.close(); fs.writeFileSync(`${out}/result.json`, JSON.stringify(results, null, 2)); }
if (results.some(r => !r.pass)) process.exitCode = 1;
