/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// D19 팀 포트: 웹 9501 · app-api 9521 · model-api 9541.
// 개발 서버도 9501을 쓴다. 팀 서버에서는 운영 nginx(9501)와 부딪히므로 로컬 PC에서만 띄운다(quickstart §3).
const WEB_PORT = Number(process.env.WEB_PORT ?? 9501)
const APP_API = process.env.APP_API_URL ?? 'http://127.0.0.1:9521'
const MODEL_API = process.env.MODEL_API_URL ?? 'http://127.0.0.1:9541'

// nginx 라우팅(quickstart §4)과 같은 순서: /v1/models/* → model-api, 그 밖의 /v1/* 등 → app-api
const proxy = {
  '/v1/models': { target: MODEL_API, changeOrigin: true },
  '/v1': { target: APP_API, changeOrigin: true },
  '/live': { target: APP_API, changeOrigin: true },
  '/ready': { target: APP_API, changeOrigin: true },
  '/openapi.json': { target: APP_API, changeOrigin: true },
  '/_files': { target: APP_API, changeOrigin: true },
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '127.0.0.1', port: WEB_PORT, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: WEB_PORT, strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
})
