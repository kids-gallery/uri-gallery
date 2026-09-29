import { createRouter, createWebHistory } from 'vue-router'

// T004 골격용 최소 라우터. /app·/ops 분리, 역할 가드, 레이아웃은 T040에서 이 파일을 채운다.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./StartView.vue') },
  ],
})
