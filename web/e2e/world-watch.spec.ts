// #37 3D 화면 상태 묻기(마스터플랜 3-3): 실제 app-api를 멈췄다 켠다. 멈추면 알리고, 다시 시도로 이어지고, 처리가 끝나면 묻기를 멈춘다. 390 · 1440.
import { expect, test, type Page } from '@playwright/test';
import { startApi, stopApi } from './stack/api-control';
import { animatedJobs, e2eDb, type Connection } from './stack/db';
import { album, openWorldUpload, photo, tag, useCrop } from './stack/world';

/** SHOTS=폴더면 화면을 찍어 둔다(사람 눈 확인용) */
async function shot(page: Page, name: string) { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${page.viewportSize()!.width}.png` }); }

let db: Connection;
test.beforeAll(async () => { db = await e2eDb(); });
test.afterAll(async () => { await db?.end(); });
test.describe.configure({ timeout: 240_000 });

test('app-api가 멈추면 알리고, 켠 뒤 다시 시도로 이어지며, 끝나면 묻지 않는다', async ({ page }) => {
  // 첫 묻기는 진행 중인 단계를 넣을 때까지 붙잡는다(이 스택에는 활성 모델이 없어 업로드만으로는 단계가 생기지 않는다)
  let seeded: () => void = () => undefined;
  const ready = new Promise<void>((r) => { seeded = r; });
  await page.route('**/v1/artworks/*', async (route) => { await ready; await route.continue(); });
  const asks: number[] = [];
  page.on('response', (r) => { if (/\/v1\/artworks\/[^/]+$/.test(r.url()) && r.request().method() === 'GET') asks.push(r.status()); });

  await openWorldUpload(page, tag('w37'));
  const posted = page.waitForResponse((r) => r.url().endsWith('/v1/artworks') && r.request().method() === 'POST');
  await album(page).setInputFiles(photo());
  await useCrop(page);
  const id = String((await (await posted).json() as { id: string }).id);
  await animatedJobs(db, id, (v) => db.query(`INSERT INTO stage_job (artwork_id, stage_kind, origin, serving_group, model_version_id) VALUES (?, 'animate_render', 'confirm', 'gpu', ?)`, [id, v]).then(() => undefined));
  seeded();
  await expect.poll(() => asks.filter((s) => s === 200).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const retryBtn = page.getByRole('button', { name: '다시 시도' });
  await expect(retryBtn).toHaveCount(0);

  try {
    await stopApi();
    await expect(page.getByText('미술관에 연결되지 않아요')).toBeVisible({ timeout: 30_000 });
    await expect(retryBtn).toBeVisible();
    await expect(page).toHaveURL(/\/app\/world/); // 화면을 옮기지 않는다
    await shot(page, 'watch-offline');

    await retryBtn.click(); // 아직 꺼져 있으면 안내가 그대로다
    await expect(page.getByText('미술관에 연결되지 않아요')).toBeVisible();
  } finally {
    await startApi();
  }

  const before = asks.filter((s) => s === 200).length;
  await retryBtn.click();
  await expect(page.getByText('미술관에 연결되지 않아요')).toHaveCount(0, { timeout: 15_000 });
  await expect(retryBtn).toHaveCount(0);
  expect(asks.filter((s) => s === 200).length).toBeGreaterThan(before);
  await expect(page).toHaveURL(/\/app\/world/);
  await shot(page, 'watch-recovered');

  await db.query(`UPDATE stage_job SET status = 'done' WHERE artwork_id = ?`, [id]);
  await expect.poll(async () => { const n = asks.length; await page.waitForTimeout(11_000); return asks.length - n; }, { timeout: 60_000, intervals: [0] }).toBe(0);
});

test('새로 고침 때 작품 목록을 못 읽어도 복구 뒤 다시 시도로 대기 작품을 읽는다(#85 리뷰)', async ({ page }) => {
  await openWorldUpload(page, tag('w85'));
  const posted = page.waitForResponse((r) => r.url().endsWith('/v1/artworks') && r.request().method() === 'POST');
  await album(page).setInputFiles(photo());
  await useCrop(page);
  const id = String((await (await posted).json() as { id: string }).id);

  const list = /\/v1\/artworks$/;
  await page.route(list, (route) => (route.request().method() === 'GET' ? route.abort() : route.continue()));
  await page.reload();
  await page.getByRole('button', { name: '시작하기' }).click();
  const retryBtn = page.getByRole('button', { name: '다시 시도' });
  await expect(page.getByText('미술관에 연결되지 않아요')).toBeVisible({ timeout: 60_000 });
  await expect(retryBtn).toBeVisible();

  await page.unroute(list);
  const asked = page.waitForResponse((r) => r.url().endsWith(`/v1/artworks/${id}`) && r.request().method() === 'GET', { timeout: 15_000 });
  await retryBtn.click();
  expect((await asked).status()).toBe(200);
  await expect(page.getByText('미술관에 연결되지 않아요')).toHaveCount(0, { timeout: 15_000 });
});
