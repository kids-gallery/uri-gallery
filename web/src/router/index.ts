// 라우터 골격(T004). 보호자 /app 과 운영 /ops 를 나눈다(UX8). 역할 가드·메뉴·next 복귀는 T040.
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/app' },
  { path: '/app', name: 'app-home', component: () => import('@/views/ShellPlaceholder.vue'), props: { shell: 'app' } },
  { path: '/ops', name: 'ops-home', component: () => import('@/views/ShellPlaceholder.vue'), props: { shell: 'ops' } },
  { path: '/:pathMatch(.*)*', redirect: '/app' },
];

export const router = createRouter({ history: createWebHistory(), routes });
