// 3D 화면 흐름 시험 공통(#31·#37): 로그인 창(#30)·아이 고르기(#36) 전이라 세션과 아이는 API로 만든다.
import { expect, type Page } from '@playwright/test';
import { drawingPng, guardianWithChild } from './guardian';

export const tag = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
export const photo = (name = 'drawing.png', buffer = drawingPng()) => ({ name, mimeType: 'image/png', buffer });
/** 창 안의 파일 입력 두 개 중 앨범(여러 장) */
export const album = (page: Page) => page.getByRole('dialog', { name: '작품 올리기' }).locator('input[type=file][multiple]');

/** 가입 → 아이 1명 → 3D 화면 → 올리기 창 */
export async function openWorldUpload(page: Page, who: string) {
  await guardianWithChild(page, who);
  await page.goto('/app/world');
  await expect(page.getByText('이 기기에 저장돼요')).toHaveCount(0); // 서버 판은 기기에 저장한다고 말하지 않는다
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.getByRole('button', { name: '작품 올리기', exact: true }).first().click({ timeout: 60_000 });
  await expect(page.getByRole('dialog', { name: '작품 올리기' })).toBeVisible();
  await expect(page.getByText('JPEG·PNG·HEIC')).toBeVisible();
}

/** 작품 자르기(#118): 고른 사진마다 작품만 찍었다고, 종류를 답하고 네 모서리를 그대로 두고 쓴다 */
export async function useCrop(page: Page, times = 1, kind: '그림이에요' | '만들기예요' = '그림이에요') {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', { name: '작품만 찍었어요' }).click({ timeout: 30_000 });
    await page.getByRole('button', { name: kind }).click();
    await page.getByRole('button', { name: '이대로 쓰기' }).click();
  }
}
