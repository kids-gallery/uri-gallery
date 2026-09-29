import { expect, test } from '@playwright/test'

// 두 너비(390·1440) 모두에서 첫 화면이 뜨고 가로 스크롤이 생기지 않는다(SD_02 §17 모바일 우선)
test('첫 화면이 뜨고 가로로 넘치지 않는다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('우리 아이 미술관')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
