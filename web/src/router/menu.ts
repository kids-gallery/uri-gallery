// 셸 메뉴(T040). 운영 메뉴는 SD_02 §2-1 역할별 메뉴 표(D21·D22 ⑤)가 정본이다 — API 역할 검사와 같은 값.
import { ko } from '@/copy/ko';
import type { MenuItem } from '@/components/RoleHeader.vue';

export const APP_MENU: MenuItem[] = [
  { to: '/app', label: ko.shell.appMenu.artworks },
  { to: '/app/upload', label: ko.shell.appMenu.upload },
  { to: '/app/gallery', label: ko.shell.appMenu.gallery },
  { to: '/app/children', label: ko.shell.appMenu.children },
  { to: '/app/family', label: ko.shell.appMenu.family },
];

/** 화면별 접근 역할(읽기 포함). */
export const OPS_ROLES = {
  status: ['operator', 'evaluator', 'integrator'],
  models: ['operator', 'evaluator', 'integrator'],
  apiGuide: ['operator', 'integrator'],
} as const;

export function opsMenu(roles: readonly string[]): MenuItem[] {
  const has = (need: readonly string[]) => roles.some((r) => need.includes(r));
  const m: MenuItem[] = [];
  if (has(OPS_ROLES.status)) m.push({ to: '/ops/status', label: ko.shell.menu.status });
  if (has(OPS_ROLES.models)) m.push({ to: '/ops/models', label: has(['operator', 'evaluator']) ? ko.shell.menu.models : ko.shell.menu.modelsRead });
  if (has(OPS_ROLES.apiGuide)) m.push({ to: '/ops/api-guide', label: ko.shell.menu.apiGuide });
  return m;
}

/** next 복귀 주소는 같은 셸의 상대 경로만 받는다(열린 이동 방지). */
export function safeNext(next: unknown, shell: 'app' | 'ops'): string {
  const home = shell === 'app' ? '/app' : '/ops';
  return typeof next === 'string' && next.startsWith(home) && !next.startsWith('//') && !next.includes('://') ? next : home;
}
