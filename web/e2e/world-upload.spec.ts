// #31 3D 화면 사진 올리기(마스터플랜 3-3): 실제 app-api·DB에 올린다. 정상 · 용량 초과 · 깨진 사진 · 응답을 못 받고 다시 시도해도 작품 1건 · 로그인 풀림. 390 · 1440.
import { expect, test, type Page } from '@playwright/test';
import { drawingPng } from './stack/guardian';
import { album, openWorldUpload, photo, tag } from './stack/world';

/** SHOTS=폴더면 화면을 찍어 둔다(사람 눈 확인용) */
async function shot(page: Page, name: string) { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${page.viewportSize()!.width}.png` }); }
const works = async (page: Page) => (await (await page.request.get('/v1/artworks')).json() as { id: string }[]).length;
const openUpload = (page: Page) => openWorldUpload(page, tag('w31'));

test.describe.configure({ timeout: 180_000 });

test('정상: 서버에 한 건 저장되고 원본 액자로 걸린다', async ({ page }) => {
  await openUpload(page);
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/artworks') && r.request().method() === 'POST');
  await album(page).setInputFiles(photo());
  const r = await res;
  expect(r.status(), await r.text()).toBe(202);
  expect(await r.json()).toMatchObject({ exhibited: true, hungResultKind: 'frame' });
  expect(r.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole('dialog', { name: '작품 올리기' })).toBeHidden(); // 창이 닫히고 작품 앞으로 간다
  await expect(page.locator('.w-saved-thumb')).toBeVisible({ timeout: 60_000 }); // 3D 화면에 걸린 뒤에 결과 카드가 나온다
  await expect(page.getByRole('group', { name: '몇 살 때 작품인가요' })).toHaveCount(0); // 서버 판은 나이를 묻지 않고
  await expect(page.getByRole('group', { name: '사진 돌리기' })).toHaveCount(0); // 돌리지도 않는다(D46)
  await expect(page.getByText('이 기기에 저장돼요')).toHaveCount(0);
  await expect(page.getByText('배경을 찾지 못해')).toHaveCount(0); // 배경 분리는 서버 몫이다
  await shot(page, 'hung');
  expect(await works(page)).toBe(1);
});

test('용량 초과: 서버로 보내지 않고 이유를 보인다', async ({ page }) => {
  await openUpload(page);
  let posted = 0;
  page.on('request', (q) => { if (q.url().endsWith('/v1/artworks') && q.method() === 'POST') posted++; });
  await album(page).setInputFiles(photo('big.png', Buffer.concat([drawingPng(), Buffer.alloc(20 * 1024 * 1024)])));
  await expect(page.getByText('사진이 너무 커요(한 장 20MB까지)')).toBeVisible();
  await shot(page, 'too-big');
  expect(posted).toBe(0);
  expect(await works(page)).toBe(0);
});

test('깨진 사진: 서버가 거절한 이유를 보이고 다시 시도 버튼이 없다', async ({ page }) => {
  await openUpload(page);
  const res = page.waitForResponse((r) => r.url().endsWith('/v1/artworks') && r.request().method() === 'POST');
  await album(page).setInputFiles(photo('broken.png', drawingPng().subarray(0, 60)));
  expect((await res).status()).toBeGreaterThanOrEqual(400);
  await expect(page.getByText('이 사진은 읽을 수 없어요')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
  expect(await works(page)).toBe(0);
});

test('서버는 저장했는데 응답을 못 받아도, 다시 시도하면 작품은 1건이다', async ({ page }) => {
  await openUpload(page);
  const keys: string[] = [];
  let lost = false;
  await page.route('**/v1/artworks', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    keys.push(route.request().headers()['idempotency-key']!);
    if (lost) return route.continue();
    lost = true;
    await route.fetch(); // 서버까지는 닿아 저장되고
    await route.abort('connectionreset'); // 응답만 사라진다
  });
  await album(page).setInputFiles(photo());
  await expect(page.getByText('미술관에 연결되지 않아요')).toBeVisible();
  await shot(page, 'retry');
  expect(await works(page)).toBe(1);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('dialog', { name: '작품 올리기' })).toBeHidden();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(await works(page)).toBe(1);
});

test('로그인이 풀렸으면 알리고, 다시 로그인한 뒤 같은 사진을 다시 시도할 수 있다', async ({ page, context }) => {
  await openUpload(page);
  const state = await context.storageState();
  await context.clearCookies();
  await album(page).setInputFiles(photo());
  await expect(page.getByText('로그인이 필요해요')).toBeVisible();
  expect(page.url()).toContain('/app/world'); // /app/login으로 옮기지 않는다
  await context.addCookies(state.cookies);
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('dialog', { name: '작품 올리기' })).toBeHidden();
  expect(await works(page)).toBe(1);
});
