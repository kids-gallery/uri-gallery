// 미술관 모드 창에도 나가는 버튼이 있다(마스터플랜 3-3). 390 · 1440.
import { expect, test } from '@playwright/test';
import { guardianWithChild } from './stack/guardian';
import { tag } from './stack/world';

test('모드 창을 열고, 모드를 바꾼 뒤에도 닫기로 나간다', async ({ page }) => {
  test.setTimeout(180_000);
  await guardianWithChild(page, tag('theme'));
  await page.goto('/app/world');
  await page.getByRole('button', { name: '시작하기' }).click({ timeout: 60_000 });
  await page.getByRole('button', { name: '작품 올리기', exact: true }).first().waitFor({ timeout: 60_000 });
  const dialog = page.getByRole('dialog', { name: '미술관 모드' });
  await page.getByRole('button', { name: /모드 바꾸기/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /모드 바꾸기/ }).click();
  await dialog.locator('.theme[aria-pressed="false"]').first().click();
  await expect(dialog.locator('.theme').first()).toBeEnabled({ timeout: 60_000 });
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toBeHidden();
});
