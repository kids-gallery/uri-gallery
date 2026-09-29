// 라우터·가드(T040, SD_02 §2, D21). 보호자 /app 과 운영 /ops 를 나누고 서로 링크하지 않는다(UX8).
// - 보호자: GET /v1/me — 401이면 S0a(/app/login?next=), 가족이 없으면 S1d(/app/no-family).
// - 팀원: GET /v1/ops/me — 401이면 S0o(/ops/login?next=), 역할 없는 화면은 G1(/ops/forbidden).
// - 메일 링크: /app/verify · /app/reset · /app/invite (?token=).
import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router';
import { ApiError, setNavigator } from '@/api/client';
import { useSession } from '@/stores/session';
import { OPS_ROLES, safeNext } from './menu';

declare module 'vue-router' {
  interface RouteMeta { shell?: 'app' | 'ops'; public?: boolean; noFamilyOk?: boolean; roles?: readonly string[] }
}

const Pending = () => import('@/views/PendingView.vue');
const pending = (screen: string, title: string, task: string) => ({ component: Pending, props: { screen, title, task } });

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/app' },
  // 보호자 — 로그인 전
  { path: '/app/login', component: () => import('@/app/views/LoginView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/signup', component: () => import('@/app/views/SignupView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/verify', component: () => import('@/app/views/VerifyView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/recovery', component: () => import('@/app/views/RecoveryView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/reset', component: () => import('@/app/views/ResetView.vue'), meta: { shell: 'app', public: true } },
  // 보호자 — 가족 없어도 되는 화면
  { path: '/app/invite', ...pending('S1c', '초대 수락', 'T107'), meta: { shell: 'app', noFamilyOk: true } },
  { path: '/app/no-family', ...pending('S1d', '가족 없음', 'T107'), meta: { shell: 'app', noFamilyOk: true } },
  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { shell: 'app' },
    children: [
      { path: '', name: 'app-home', ...pending('S4', '작품 목록', 'T080') },
      { path: 'artworks/:id', ...pending('S4', '진행 상세', 'T080') },
      { path: 'artworks/:id/confirm', ...pending('S3', '판정 제안 확정', 'T067') },
      { path: 'artworks/:id/review', ...pending('S5', '결과 확인', 'T094') },
      { path: 'artworks/:id/story', ...pending('S6', '이야기 쓰기', 'T095') },
      { path: 'upload', ...pending('S2', '작품 올리기', 'T066') },
      { path: 'children', component: () => import('@/app/views/ChildrenView.vue') },
      { path: 'family', ...pending('S1b', '가족 보호자', 'T107') },
      { path: 'gallery', ...pending('S8', '가족 전시', 'T096') },
    ],
  },
  // 팀원
  { path: '/ops/login', ...pending('S0o', '팀원 로그인', 'T055'), meta: { shell: 'ops', public: true } },
  {
    path: '/ops',
    component: () => import('@/layouts/OpsLayout.vue'),
    meta: { shell: 'ops' },
    children: [
      { path: '', redirect: '/ops/status' },
      { path: 'status', ...pending('S10', '서비스 상태와 모델별 지표', 'T112'), meta: { roles: OPS_ROLES.status } },
      { path: 'models', ...pending('S11', '모델 평가와 승격', 'T119'), meta: { roles: OPS_ROLES.models } },
      { path: 'api-guide', ...pending('S12', 'API활용', 'T125'), meta: { roles: OPS_ROLES.apiGuide } },
      { path: 'forbidden', component: () => import('@/views/OpsForbiddenView.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/app' },
];

export function installGuards(router: Router) {
  router.beforeEach(async (to) => {
    const shell = to.matched.find((r) => r.meta.shell)?.meta.shell;
    if (!shell || to.matched.some((r) => r.meta.public)) return true;
    const s = useSession();
    const login = { path: `/${shell}/login`, query: { next: safeNext(to.fullPath, shell) } };
    if (shell === 'app') {
      try {
        const me = await s.loadGuardian();
        if (!me.hasFamily && !to.matched.some((r) => r.meta.noFamilyOk)) return '/app/no-family';
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return login;
        if (e instanceof ApiError && e.reason === 'no_family') return '/app/no-family';
        // 그 밖(무응답 등)은 화면이 §17 전역 실패 규칙으로 보인다
      }
      return true;
    }
    let roles: readonly string[] = [];
    try {
      roles = (await s.loadStaff()).roles;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return login;
      if (e instanceof ApiError && e.status === 403) return to.path === '/ops/forbidden' ? true : '/ops/forbidden';
      return true;
    }
    const need = to.matched.flatMap((r) => r.meta.roles ?? []);
    if (need.length && !roles.some((r) => need.includes(r))) return '/ops/forbidden';
    return true;
  });
  setNavigator({
    toLogin(shell) {
      useSession().reset();
      const cur = router.currentRoute.value.fullPath;
      void router.push({ path: `/${shell}/login`, query: { next: safeNext(cur, shell) } });
    },
    toNoFamily() { void router.push('/app/no-family'); },
  });
}

export function makeRouter() {
  const router = createRouter({ history: createWebHistory(), routes });
  installGuards(router);
  return router;
}
