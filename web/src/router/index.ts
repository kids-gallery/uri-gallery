// 라우터·가드(T040, SD_02 §2, D21). 보호자 /app 과 운영 /ops 를 나누고 서로 링크하지 않는다(UX8).
// - 보호자: GET /v1/me — 401이면 S0a(/app/login?next=), 가족이 없으면 S1d(/app/no-family).
// - 팀원: GET /v1/ops/me — 401이면 S0o(/ops/login?next=), 역할 없는 화면은 G1(/ops/forbidden).
// - 메일 링크: /app/verify · /app/reset · /app/invite (?token=).
import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router';
import { ApiError, setNavigator } from '@/api/client';
import { useSession } from '@/stores/session';
import { OPS_ROLES, safeNext } from './menu';
import { isFirstVisit } from '@/app/entrance';
import { isClassic } from '@/app/museumTheme';

declare module 'vue-router' {
  interface RouteMeta { shell?: 'app' | 'ops'; public?: boolean; noFamilyOk?: boolean; roles?: readonly string[] }
}

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/app' },
  // 보호자 — 로그인 전
  { path: '/app/welcome', component: () => import('@/app/views/WelcomeView.vue'), meta: { shell: 'app', public: true } }, // S0w 입장(제안 SD_02 §17-2)
  { path: '/app/login', component: () => import('@/app/views/LoginView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/signup', component: () => import('@/app/views/SignupView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/verify', component: () => import('@/app/views/VerifyView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/recovery', component: () => import('@/app/views/RecoveryView.vue'), meta: { shell: 'app', public: true } },
  { path: '/app/reset', component: () => import('@/app/views/ResetView.vue'), meta: { shell: 'app', public: true } },
  // 보호자 — 가족 없어도 되는 화면
  { path: '/app/invite', component: () => import('@/app/views/InviteAcceptView.vue'), meta: { shell: 'app', noFamilyOk: true } },
  { path: '/app/no-family', component: () => import('@/app/views/NoFamilyView.vue'), meta: { shell: 'app', noFamilyOk: true } },
  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { shell: 'app' },
    children: [
      // 홈: 시안 전환은 museumTheme.ts 한 줄(D30, SD_02 §17-5) — v2 = §17-3 홈, classic-a · classic-b = 고전 미술관 시안
      { path: '', name: 'app-home', component: () => (isClassic() ? import('@/app/views/ClassicHomeView.vue') : import('@/app/views/PaperHomeView.vue')) },
      { path: 'hall', name: 'app-hall', component: () => import('@/app/views/MuseumView.vue') }, // 전시실 — 평면도 · N세관 · 작품 앞 ?art=(SD_02 §17-4)
      { path: 'works', component: () => import('@/app/views/ArtworksView.vue') }, // S4 작품 목록 → 작품 관리
      { path: 'artworks/:id', component: () => import('@/app/views/ArtworkDetailView.vue') },
      { path: 'artworks/:id/confirm', component: () => import('@/app/views/ConfirmView.vue') },
      { path: 'artworks/:id/review', component: () => import('@/app/views/ReviewView.vue') },
      { path: 'artworks/:id/story', component: () => import('@/app/views/StoryView.vue') },
      { path: 'upload', component: () => import('@/app/views/UploadView.vue') },
      { path: 'children', component: () => import('@/app/views/ChildrenView.vue') },
      { path: 'account', component: () => import('@/app/views/AccountView.vue') }, // S0c 비밀번호 변경(T161)
      { path: 'family', component: () => import('@/app/views/FamilyView.vue') },
      { path: 'draft/paper', redirect: (to) => ({ path: '/app', query: to.query }) }, // 시안 경로는 홈으로(D26 ⑥)
      { path: 'gallery', redirect: (to) => ({ path: '/app/hall', query: to.query }) }, // S8 = 전시실(SD_02 §17-4)
    ],
  },
  // 팀원
  { path: '/ops/login', component: () => import('@/ops/views/OpsLoginView.vue'), meta: { shell: 'ops', public: true } },
  {
    path: '/ops',
    component: () => import('@/layouts/OpsLayout.vue'),
    meta: { shell: 'ops' },
    children: [
      { path: '', redirect: '/ops/status' },
      { path: 'status', component: () => import('@/ops/views/OpsStatusView.vue'), meta: { roles: OPS_ROLES.status } },
      { path: 'models', component: () => import('@/ops/views/ModelsView.vue'), meta: { roles: OPS_ROLES.models } },
      { path: 'api-guide', component: () => import('@/ops/views/ApiGuideView.vue'), meta: { roles: OPS_ROLES.apiGuide } },
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
        // 로그인 전 첫 방문이면 입장 화면(S0w)을 한 번 거친다
        if (e instanceof ApiError && e.status === 401) return isFirstVisit() ? { path: '/app/welcome', query: login.query } : login;
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
