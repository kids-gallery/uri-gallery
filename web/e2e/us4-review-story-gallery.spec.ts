// T087 [US4] 확인 → 이야기 → 전시 E2E(390·1440px): 자동 재생 없음 · 원본 보기 · 점수·토스트 없음.
// 액자 경로를 실제 CPU 워커(frame_compose)로 끝까지 돌린다. 활성 모델이 없어 움직임·2.5D 결과(재생·원본 나란히 토글)는
// 이 스택에서 만들 수 없다 — 모델이 켜진 뒤 같은 파일에 덧붙인다(액자는 결과가 원본이라 원본 토글이 없어야 맞다).
import { expect, test, type Page } from '@playwright/test';
import { ko } from '../src/copy/ko';
import { drawingPng, guardianWithChild } from './stack/guardian';

async function noScoreNoToast(page: Page) {
  const text = await page.locator('main').innerText();
  for (const bad of ['점수', '확률', '%']) expect(text).not.toContain(bad);
  await expect(page.locator('[class*="toast"], [role="status"][class*="snack"]')).toHaveCount(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.autoplay || !v.paused).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('액자로 확정 → 결과 확인(좋아요) → 이야기 저장 → 전시에 걸리고 전시에서 열린다', async ({ page }, info) => {
  await guardianWithChild(page, `us4-${info.project.name}`);
  await page.goto('/app/upload');
  await page.locator('input[type=file][accept^="image/jpeg"]').setInputFiles({ name: 'drawing.png', mimeType: 'image/png', buffer: drawingPng() });
  await page.getByRole('button', { name: ko.upload.submit, exact: true }).click();
  await expect(page).toHaveURL(/\/confirm$/);
  await page.getByRole('group', { name: ko.confirm.howTitle }).getByRole('button', { name: ko.kind.frame, exact: true }).click();
  await page.getByRole('button', { name: ko.confirm.submit, exact: true }).click();
  await expect(page).toHaveURL(/started=1$/);

  // S4 진행 → 워커가 액자를 끝내면 결과 확인으로(폴링)
  await expect(page.getByRole('link', { name: ko.list.toReview })).toBeVisible({ timeout: 30_000 });
  await noScoreNoToast(page);
  await page.getByRole('link', { name: ko.list.toReview }).click();
  await expect(page).toHaveURL(/\/review$/);
  await noScoreNoToast(page);

  // S5 좋아요 → S6 이야기
  await page.getByRole('button', { name: ko.review.decision.like, exact: true }).click();
  await expect(page).toHaveURL(/\/story\?approved=1$/);
  await page.getByLabel(ko.story.title).fill('빨간 해');
  await page.getByLabel(ko.story.madeOn).fill('2026-09-01');
  await page.getByLabel(ko.story.age).fill('6');
  await page.getByRole('button', { name: ko.story.save, exact: true }).click();
  await expect(page.getByText(ko.story.exhibited)).toBeVisible();
  await noScoreNoToast(page);

  // 전시 = 홈 전시실(D25): N세관 안에 걸리고, 열면 월 라벨과 정지 화면(액자는 원본·재생 토글 없음)
  await page.getByRole('link', { name: ko.list.toGallery }).click();
  await expect(page).toHaveURL(/\/app(\?|$)/);
  const room = page.getByRole('region', { name: ko.museum.room(6) });
  await expect(room.getByText('빨간 해')).toBeVisible();
  await room.getByRole('button', { name: '빨간 해' }).click();
  await expect(page.getByRole('button', { name: ko.museum.back })).toBeVisible();
  await expect(page.locator('.wl-kind')).toHaveText(ko.museum.kind.frame!);
  await expect(page.locator('button[aria-pressed]')).toHaveCount(0);
  await noScoreNoToast(page);
});
