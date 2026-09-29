import { defineConfig, devices } from '@playwright/test'

// R-19: SD_02 확인 너비 두 가지 — 모바일 390px · 데스크톱 1440px
const WEB_PORT = Number(process.env.WEB_PORT ?? 9501)
const baseURL = `http://127.0.0.1:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
