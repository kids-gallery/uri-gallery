// T059 [US2] 올리기 → 확정 E2E(390·1440px): 선택지 즉시 표시 · 기본 선택 없음 · "나중에 고르기".
// E2E 스택에는 활성 모델이 없다(p1과 같은 상태) — 움직임·2.5D는 이유 달린 비활성(C3), 액자만 고를 수 있다.
import { expect, test } from '@playwright/test';
import { ko } from '../src/copy/ko';
import { drawingPng, guardianWithChild } from './stack/guardian';

test('올리면 바로 확정 화면, 기본 선택 없음, 나중에 고르기 → 다시 와서 액자로 확정', async ({ page }, info) => {
  await guardianWithChild(page, `us2-${info.project.name}`);

  await page.goto('/app/upload');
  await page.locator('input[type=file][accept^="image/jpeg"]').setInputFiles({ name: 'drawing.png', mimeType: 'image/png', buffer: drawingPng() });
  await page.getByRole('button', { name: ko.upload.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/app\/artworks\/[^/]+\/confirm$/);
  const confirmUrl = new URL(page.url()).pathname;

  // 선택지 즉시 표시(판정을 기다리지 않음) · 순서 고정 · 기본 선택 없음
  const opts = page.getByRole('group', { name: ko.confirm.howTitle }).getByRole('button');
  await expect(opts).toHaveCount(3);
  await expect(opts.nth(0)).toContainText(ko.kind.animated!);
  await expect(opts.nth(1)).toContainText(ko.kind.relief!);
  await expect(opts.nth(2)).toHaveText(ko.kind.frame!);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  for (const i of [0, 1]) {
    await expect(opts.nth(i)).toHaveAttribute('aria-disabled', 'true');
    await expect(opts.nth(i)).toContainText(ko.review.unavailable.model_disabled!);
  }
  // 세 칸 같은 크기(UX2)
  const boxes = await opts.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  expect(new Set(boxes.map((b) => b.join('x'))).size).toBe(1);
  // 고르기 전 확정은 이유 달린 비활성
  await expect(page.getByRole('button', { name: new RegExp(`^${ko.confirm.submit}`) })).toContainText(ko.confirm.pickOne);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // 나중에 고르기 → 목록, 다시 들어오면 여전히 기본 선택 없음
  await page.getByRole('link', { name: ko.confirm.later }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto(confirmUrl);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);

  await opts.nth(2).click();
  await expect(opts.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: ko.confirm.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/app\/artworks\/[^/]+\?started=1$/);
});
