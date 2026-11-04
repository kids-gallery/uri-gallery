import { expect, test } from '@playwright/test';
import { guardianWithChild } from './stack/guardian';
import { tag } from './stack/world';

// 설계서 3D미술관_재설계 2-1 "문 드나들기"
test('화면 버튼을 누른 뒤 방향키만으로 밖에서 미술관에 들어가고, 도중에 손을 떼도 입장이 끝난다', async ({ page, isMobile }) => {
  test.skip(isMobile, '휴대폰은 아래 조이스틱 시험');
  await guardianWithChild(page, tag('walkin'));
  await page.goto('/app/world');
  await page.getByRole('button', { name: '시작하기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '더보기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '밖으로' }).click();
  await expect(page.getByText('바깥 광장', { exact: true })).toBeVisible();
  const wave = page.getByRole('button', { name: '손 흔들기' });
  await wave.click();
  await expect(wave).toBeFocused();
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
