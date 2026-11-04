// 친구(마스터플랜 3-3 #137): 두 가족이 실제 app-api·DB로 맺자마자 서로 보이고, 접속 상태가 맞고, 끊으면 방문이 끝난다. 390 · 1440.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { openWorldUpload, tag } from './stack/world';

test.describe.configure({ timeout: 240_000 });

async function family(browser: Browser, name: string, options: { viewport: { width: number; height: number } | null }): Promise<Page> {
  const page = await (await browser.newContext({ viewport: options.viewport, baseURL: test.info().project.use.baseURL })).newPage();
  await openWorldUpload(page, tag(name));
  await page.getByRole('dialog', { name: '작품 올리기' }).getByRole('button', { name: '닫기' }).click();
  return page;
}
const friendPanel = (page: Page) => page.getByRole('dialog', { name: '친구' });
/** SHOTS=폴더면 화면을 찍어 둔다(사람 눈 확인용) */
async function shot(page: Page, name: string) { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${page.viewportSize()!.width}.png` }); }

test('맺자마자 양쪽에 뜨고, 접속 상태가 보이고, 들어갔다 나오고, 끊으면 잠긴다', async ({ browser, viewport }) => {
  const a = await family(browser, 'fa', { viewport }), b = await family(browser, 'fb', { viewport });
  // 친구 메뉴는 아래쪽 바에 있고, 처음에는 친구가 없다고 말한다
  await a.locator('.w-bar').getByRole('button', { name: '친구' }).click();
  await expect(friendPanel(a).getByText('아직 친구가 없어요')).toBeVisible();
  await friendPanel(a).getByRole('button', { name: '초대 링크 만들기' }).click();
  const link = await friendPanel(a).locator('.w-link').inputValue();
  await expect(friendPanel(a).getByRole('button', { name: '링크 보내기' })).toBeVisible();
  await shot(a, 'invite');
  await friendPanel(a).getByRole('button', { name: '닫기' }).click();

  // 받은 쪽: 수락하면 창이 닫히지 않고 새 친구가 맨 위에 뜬다
  await b.goto(new URL(link).pathname + new URL(link).search);
  const start = b.getByRole('button', { name: '시작하기' });
  await expect(start).toBeVisible({ timeout: 120_000 });
  await start.click();
  await friendPanel(b).getByRole('button', { name: '친구 되기' }).click({ timeout: 60_000 });
  await expect(friendPanel(b).getByText('방금 친구가 됐어요')).toBeVisible();
  await expect(friendPanel(b).getByRole('button', { name: '들어가기' })).toBeVisible();

  await shot(b, 'fresh');
  // 초대한 쪽: 아무것도 누르지 않아도 10초 안에 카드가 뜨고, 접속 중으로 보인다
  const card = a.locator('.w-friend-new');
  await expect(card).toContainText('가족과 친구가 됐어요', { timeout: 15_000 });
  await shot(a, 'card');
  await card.getByRole('button', { name: '닫기' }).click();
  await a.locator('.w-bar').getByRole('button', { name: /친구/ }).click();
  await expect(friendPanel(a).getByRole('list', { name: '친구 목록' }).getByText('지금 접속 중')).toBeVisible({ timeout: 15_000 });
  await expect(a.locator('.w-online')).toHaveCount(1);

  await shot(a, 'list');
  // [들어가기] 한 번으로 친구 미술관에 들어가고, 왼쪽 위 [밖으로]로 나온다
  await friendPanel(a).getByRole('button', { name: '들어가기' }).click();
  await expect(a.locator('.where strong')).toContainText('의 미술관');
  await expect(a.locator('.w-bar')).toHaveCount(0, { timeout: 30_000 });
  await expect(a.locator('.where').getByRole('button', { name: '밖으로' })).toBeVisible({ timeout: 30_000 });

  await shot(a, 'visit');
  // 상대가 끊으면 방문 중이던 쪽이 10초 안에 마을로 나온다
  await friendPanel(b).getByRole('button', { name: '끊기' }).click();
  await friendPanel(b).getByRole('button', { name: '끊기', exact: true }).last().click();
  await expect(friendPanel(b).getByText('친구 관계를 끝냈어요')).toBeVisible();
  await expect(a.locator('.where').getByRole('button', { name: '우리 미술관으로' })).toBeVisible({ timeout: 20_000 });

  await shot(a, 'town');
  // 왼쪽 위 버튼으로 곧장 집으로 돌아오고, 건물 안에서는 다시 [밖으로]가 보인다
  await a.locator('.where').getByRole('button', { name: '우리 미술관으로' }).click();
  await expect(a.locator('.w-bar').getByRole('button', { name: '들어가기' })).toBeVisible({ timeout: 30_000 }); // 마을을 떠나 우리 광장으로 왔다
  await expect(a.locator('.where').getByRole('button', { name: '우리 미술관으로' })).toHaveCount(0);
  await a.locator('.w-bar').getByRole('button', { name: '들어가기' }).click();
  await expect(a.locator('.where').getByRole('button', { name: '밖으로' })).toBeVisible({ timeout: 30_000 });
  await a.waitForTimeout(800);
  await shot(a, 'home');
});

test('설정: 서버 판에서 열리고 소리와 조작 값이 다시 들어와도 남는다', async ({ browser, viewport }) => {
  const page = await family(browser, 'fs', { viewport });
  await page.locator('.w-more-tools').click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '설정' });
  await expect(panel.getByRole('button', { name: '닫기' })).toBeInViewport(); // 스크롤하지 않아도 닫을 수 있다
  await panel.getByLabel(/음악 크기/).fill('30');
  await panel.getByLabel(/효과음 크기/).fill('0');
  await panel.getByLabel('화면 끌기 방향 반대로').check();
  await panel.getByRole('button', { name: '빠르게' }).click();
  await panel.getByLabel('미니맵 보이기').uncheck();
  await shot(page, 'settings');
  await page.waitForTimeout(600); // 저장은 움직임이 멎은 뒤에 한다
  await page.reload();
  const start = page.getByRole('button', { name: '시작하기' });
  await expect(start).toBeVisible({ timeout: 120_000 });
  await start.click();
  await page.locator('.w-more-tools').click({ timeout: 60_000 });
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(panel.getByLabel(/음악 크기/)).toHaveValue('30');
  await expect(panel.getByLabel(/효과음 크기/)).toHaveValue('0');
  await expect(panel.getByLabel('화면 끌기 방향 반대로')).toBeChecked();
  await expect(panel.getByRole('button', { name: '빠르게' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByLabel('미니맵 보이기')).not.toBeChecked();
});
