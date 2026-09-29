// T004 E2E 골격: 두 화면 크기에서 보호자 셸이 열린다. 흐름 E2E는 T044·T059·T075·T087.
import { expect, test } from '@playwright/test';

test('보호자 셸이 열린다', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('우리 아이 미술관');
});
