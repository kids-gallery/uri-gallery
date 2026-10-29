// Shared launch policy only; review assertions and timeouts remain in each script.
import { chromium } from '@playwright/test';

/** 시작 화면(3D미술관_재설계 §2-17)이 보이면 [시작하기]를 눌러 조작할 수 있을 때까지 기다린다. 실제 사용자와 같은 길이다 */
export async function startWorld(page, timeout = 90000) {
  const start = page.getByRole('button', { name: '시작하기', exact: true });
  await start.waitFor({ timeout });
  await start.click();
  await page.waitForFunction(() => window.__uamWorld?.debugState?.().mode === 'play' && !!document.querySelector('.hud-top .tools'), null, { timeout });
}

/** 기본 HUD(§2-17)의 버튼을 누른다. 늘 보이는 버튼이 아니면 [더보기]를 펼친 뒤 누른다 */
export async function tool(page, name) {
  const button = page.locator('.tools').getByRole('button', { name, exact: true });
  if (!(await button.isVisible())) await page.locator('.w-more-tools').click();
  await button.click();
}

export async function reviewBrowser() {
  if (process.env.WORLD_REVIEW_GPU !== '1') {
    return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  }
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const probe = await browser.newPage();
    await probe.goto('http://127.0.0.1:5173/app/world');
    await probe.waitForFunction(() => !!window.__uamWorld?.renderer, null, { timeout: 90000 });
    const renderer = await probe.evaluate(() => {
      const gl = window.__uamWorld.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    });
    if (!renderer || /swiftshader|llvmpipe|softpipe|software|basic render|warp/i.test(renderer)) throw Error(`Hardware renderer required: ${renderer}`);
    console.log(`HARDWARE ${browser.version()} ${renderer}`);
    await probe.close();
    return browser;
  } catch (e) { await browser.close(); throw e; }
}
