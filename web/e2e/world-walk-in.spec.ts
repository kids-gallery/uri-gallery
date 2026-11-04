import { expect, test } from '@playwright/test';
import { guardianWithChild } from './stack/guardian';
import { album, photo, tag, useCrop } from './stack/world';

// 설계서 3D미술관_재설계 2-1 "문 드나들기"
test('화면 버튼을 누른 뒤 방향키만으로 밖에서 미술관에 들어가고, 도중에 손을 떼도 입장이 끝난다', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰은 아래 조이스틱 시험');
  await guardianWithChild(page, tag('walkin'));
  await page.goto('/app/world');
  await page.getByRole('button', { name: '시작하기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '더보기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '밖으로' }).click();
  await expect(page.getByText('바깥 광장', { exact: true })).toBeVisible();
  // 화면 버튼에 포커스가 남은 채로 시작한다. 손 흔들기는 #139부터 [동작] 안에 있어 [동작]을 열고 닫는다
  const gesture = page.getByRole('button', { name: '동작', exact: true });
  await gesture.click();
  await gesture.click();
  await expect(gesture).toBeFocused();
  await page.keyboard.down('ArrowUp');
  await expect(page.getByText('미술관 들어가기')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  await expect(page.getByText('바깥 광장', { exact: true })).toBeHidden({ timeout: 10_000 });
});

test('휴대폰: 조이스틱을 잡은 채 문에 들어서도 입장이 끝난다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '조이스틱은 터치 화면에만 나온다');
  test.setTimeout(120_000);
  await guardianWithChild(page, tag('walkjoy'));
  await page.goto('/app/world');
  await page.getByRole('button', { name: '시작하기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '더보기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '밖으로' }).click();
  const outside = page.getByText('바깥 광장', { exact: true });
  await expect(outside).toBeVisible();
  const box = (await page.getByRole('application', { name: '걷기 조이스틱' }).boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // 손가락은 가만있지 않는다. 입장 중에도 조이스틱 값이 계속 들어온다
  for (let i = 0; i < 100 && (await outside.isVisible()); i++) {
    await page.mouse.move(x + (i % 2 ? 1 : -1), y - box.height / 2);
    await page.waitForTimeout(250);
  }
  await page.mouse.up();
  await expect(outside).toBeHidden({ timeout: 5_000 });
});

// 입장 경로는 창을 열면 지워진다. 경로 없이 입장 중으로 남으면 버튼과 조이스틱이 모두 듣지 않는다(#166)
test('들어가는 중에 창을 열었다 닫아도 입장이 끝나고, 다시 나가 광장에서 올리면 안에서 결과를 본다', async ({ page }) => {
  test.setTimeout(180_000);
  await guardianWithChild(page, tag('walkpanel'));
  await page.goto('/app/world');
  await page.getByRole('button', { name: '시작하기' }).click({ timeout: 60_000 });
  const outside = page.getByText('바깥 광장', { exact: true });
  const goOut = async () => {
    await page.getByRole('button', { name: '더보기' }).click({ timeout: 60_000 });
    await page.getByRole('button', { name: '밖으로' }).click();
    await expect(outside).toBeVisible();
  };
  await goOut();
  await page.locator('.w-bar').getByRole('button', { name: '들어가기' }).click();
  await page.getByRole('button', { name: '더보기' }).click();
  await page.getByRole('button', { name: '사용법' }).click();
  await page.getByRole('dialog', { name: '미술관 사용법' }).getByRole('button', { name: '닫기' }).first().click();
  await expect(outside).toBeHidden({ timeout: 30_000 });

  await goOut();
  await page.locator('.w-bar').getByRole('button', { name: '작품 올리기' }).click();
  await album(page).setInputFiles(photo());
  await useCrop(page);
  await expect(outside).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('.w-saved-thumb')).toBeVisible({ timeout: 60_000 });
});
