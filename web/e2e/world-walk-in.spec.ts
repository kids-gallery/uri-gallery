import { expect, test } from '@playwright/test';
import { guardianWithChild } from './stack/guardian';
import { tag } from './stack/world';

// 설계서 3D미술관_재설계 2-1 "문 드나들기"
test('화면 버튼을 누른 뒤 방향키만으로 밖에서 미술관에 들어가고, 도중에 손을 떼도 입장이 끝난다', async ({ page }) => {
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
