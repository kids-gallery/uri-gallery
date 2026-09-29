/// <reference types="vitest/config" />
// 웹 개발 서버·빌드·단위 시험(T004, D19·D23). 개발 서버는 9501, API는 app-api 9521로 프록시한다.
// app-api에는 CORS가 없다(쿠키 세션, SameSite=lax) — 브라우저는 늘 같은 출처(9501)로 부른다.
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const port = Number(process.env.WEB_PORT ?? 9501);
const api = process.env.APP_API_URL ?? 'http://127.0.0.1:9521';
const proxy = Object.fromEntries(['/v1', '/live', '/ready', '/openapi.json'].map((p) => [p, { target: api, changeOrigin: false }]));

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port, strictPort: true, proxy },
  test: { environment: 'jsdom', include: ['src/**/*.spec.ts'] },
});
