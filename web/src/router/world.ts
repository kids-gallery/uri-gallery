// 단독 배포본(--mode world) 라우터(3D미술관_재설계 §2-19 기준 4, §2-22 9). 미술관 하나만 두고 첫 주소·모르는 주소는 미술관으로 보낸다.
// vite.config가 world 모드에서 '@/router'를 이 파일로 바꿔 쓴다. 그래서 팀 화면·로그인 확인·팀 문구가 배포본에 들어가지 않는다.
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { installTransitions } from './transitions';

export const worldOnlyRoutes: RouteRecordRaw[] = [
  { path: "/app/signup", component: () => import("@/app/world/WorldSignup.vue"), meta: { shell: "app", public: true } },
  { path: "/app/verify", component: () => import("@/app/world/WorldVerify.vue"), meta: { shell: "app", public: true } },
  { path: '/app/world', component: () => import('@/app/world/WorldView.vue'), meta: { shell: 'app', public: true } },
  { path: '/:pathMatch(.*)*', redirect: '/app/world' },
];

export function makeRouter() {
  const router = createRouter({ history: createWebHistory(), routes: worldOnlyRoutes });
  installTransitions(router);
  return router;
}
