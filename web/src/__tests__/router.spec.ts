// T040 시험: 로그인·가족·역할 가드, next 복귀 제한, 역할별 메뉴(SD_02 §2-1).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { installGuards, routes } from '../router';
import { opsMenu, safeNext } from '../router/menu';
import { setNavigator } from '../api/client';

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const unauth = () => json(401, { type: 'x', title: 't', status: 401, code: 'unauthorized', reason: 'login_required', gate: 'G0' });

function mk() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  installGuards(router);
  return router;
}
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => { vi.unstubAllGlobals(); setNavigator(null); });

describe('보호자 가드', () => {
  it('세션 없으면(재방문) S0a로, next에 원래 주소', async () => {
    localStorage.setItem('uam.entered', '1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauth()));
    const r = mk();
    await r.push('/app/works');
    expect(r.currentRoute.value.fullPath).toBe('/app/login?next=/app/works');
    localStorage.removeItem('uam.entered');
  });
  it('세션 없고 첫 방문이면 입장 화면(S0w)을 먼저, next 유지(SD_02 §17-2)', async () => {
    localStorage.removeItem('uam.entered');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauth()));
    const r = mk();
    await r.push('/app/works');
    expect(r.currentRoute.value.fullPath).toBe('/app/welcome?next=/app/works');
  });
  it('가족 없으면 S1d, 초대 링크는 그대로 연다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => json(200, { hasFamily: false, role: null })));
    const r = mk();
    await r.push('/app');
    expect(r.currentRoute.value.path).toBe('/app/no-family');
    await r.push('/app/invite?token=abc');
    expect(r.currentRoute.value.path).toBe('/app/invite');
  });
  it('가족 있으면 S4가 진입 홈', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { hasFamily: true, role: 'owner' })));
    const r = mk();
    await r.push('/');
    expect(r.currentRoute.value.name).toBe('app-home');
  });
  it('로그인 전 화면은 세션을 묻지 않는다', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const r = mk();
    await r.push('/app/reset?token=t');
    expect(r.currentRoute.value.path).toBe('/app/reset');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('팀원 가드와 메뉴', () => {
  const staff = (roles: string[]) => vi.fn().mockResolvedValue(json(200, { emailMasked: 'jo***@su.kr', roles }));
  it('세션 없으면 S0o로', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauth()));
    const r = mk();
    await r.push('/ops/models');
    expect(r.currentRoute.value.fullPath).toBe('/ops/login?next=/ops/models');
  });
  it('평가 담당은 API활용 주소로 오면 G1', async () => {
    vi.stubGlobal('fetch', staff(['evaluator']));
    const r = mk();
    await r.push('/ops/api-guide');
    expect(r.currentRoute.value.path).toBe('/ops/forbidden');
    await r.push('/ops/status');
    expect(r.currentRoute.value.path).toBe('/ops/status');
  });
  it('연동 개발은 지표·모델(읽기)·API활용', async () => {
    vi.stubGlobal('fetch', staff(['integrator']));
    const r = mk();
    await r.push('/ops/api-guide');
    expect(r.currentRoute.value.path).toBe('/ops/api-guide');
    expect(opsMenu(['integrator']).map((m) => m.label)).toEqual(['상태-지표', '모델 평가(읽기)', 'API활용']);
    expect(opsMenu(['evaluator']).map((m) => m.label)).toEqual(['상태-지표', '모델 평가']);
    expect(opsMenu(['operator']).map((m) => m.label)).toEqual(['상태-지표', '모델 평가', 'API활용']);
  });
});

describe('next 복귀', () => {
  it('같은 셸 상대 경로만', () => {
    expect(safeNext('/app/invite?token=x', 'app')).toBe('/app/invite?token=x');
    expect(safeNext('https://evil.example/app', 'app')).toBe('/app');
    expect(safeNext('//evil.example', 'app')).toBe('/app');
    expect(safeNext('/ops/status', 'app')).toBe('/app');
  });
});
