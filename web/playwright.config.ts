// E2E(T004, R-19): 휴대폰 390px · 데스크톱 1440px 두 프로젝트(SD_02 §3-5, D22 ⑥).
// 팀 서버에서는 9501을 운영 nginx가 쓰므로 로컬 PC에서 돌린다(quickstart). 다른 포트는 WEB_PORT로.
import { defineConfig } from '@playwright/test';

const port = Number(process.env.WEB_PORT ?? 9501);

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://127.0.0.1:${port}`, locale: 'ko-KR' },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: 'npm run build && npm run preview', port, reuseExistingServer: !process.env.CI },
});
