// G-1(액자 경로 한 바퀴) 화면 시험: S4 목록·상세(T080), S2 올리기(T066), S3 확정(T067), S5 결과(T094), S6 이야기(T095), S8 전시(T096), S0o(T055).
// 핵심 규칙: 선택지는 API가 준 것만·기본 선택 없음(UX2), 비활성 선택지는 사유 달린 C3, 판정 모델 비활성이면 G7 블록 없음(SD_02 §6-2),
// 처리하지 못함은 낮춘 결과가 아님(G9), 한마디는 적은 그대로, 동시 수정은 내 입력을 남긴다, 전시에는 낮춤 표시가 없다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import type { Component } from 'vue';
import ArtworksView from '../app/views/ArtworksView.vue';
import ArtworkDetailView from '../app/views/ArtworkDetailView.vue';
import UploadView from '../app/views/UploadView.vue';
import ConfirmView from '../app/views/ConfirmView.vue';
import ReviewView from '../app/views/ReviewView.vue';
import StoryView from '../app/views/StoryView.vue';
import GalleryView from '../app/views/GalleryView.vue';
import OpsLoginView from '../ops/views/OpsLoginView.vue';
import { routeFor } from '../app/artwork';
import { ko } from '../copy/ko';

const Stub = { template: '<div />' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const problem = (status: number, body: object) =>
  new Response(JSON.stringify({ type: 'about:blank', title: 't', status, ...body }), { status, headers: { 'content-type': 'application/problem+json' } });

let router: Router;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setActivePinia(createPinia());
  router = createRouter({ history: createMemoryHistory(), routes: [
    ...['', '/confirm', '/review', '/story'].map((x) => ({ path: `/app/artworks/:id${x}`, component: Stub })),
    { path: '/:p(.*)*', component: Stub },
  ] });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

/** url → 응답 사상. 함수면 매 호출마다 부른다 */
function serve(map: Record<string, unknown | ((init?: RequestInit) => Response)>) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const path = String(url).split('?')[0]!;
    const key = `${init?.method ?? 'GET'} ${path}`;
    const v = map[key] ?? map[path];
    if (v === undefined) return json({ code: 'not_found' }, 404);
    return typeof v === 'function' ? (v as (i?: RequestInit) => Response)(init) : json(v);
  });
}
async function open(view: Component, url: string) {
  await router.push(url);
  await router.isReady();
  const w = mount(view, { global: { plugins: [router], stubs: { RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>' } } }, attachTo: document.body });
  await flushPromises();
  return w;
}
const btn = (w: ReturnType<typeof mount>, label: string) => w.findAll('button').find((b) => b.text().startsWith(label));
const calls = (method: string, path: string) => fetchMock.mock.calls.filter(([u, i]) => String(u).startsWith(path) && (i?.method ?? 'GET') === method);

const base = { id: '7', childId: '1', originalUrl: '/v1/files/o', cutoutUrl: null, suggestion: null, confirmedKind: null, choices: [], unavailableChoices: [], stages: [], result: null, downgrade: null, story: {} };

describe('작품이 어디로 가는가(routeFor)', () => {
  it('확정 전 → S3, 확인 대기·처리하지 못함 → S5, 승인됨 → S6, 그 밖 → 진행 상세', () => {
    expect(routeFor({ id: '1', state: 'awaiting_confirm' })).toBe('/app/artworks/1/confirm');
    expect(routeFor({ id: '1', state: 'judging', confirmedKind: 'frame' })).toBe('/app/artworks/1');
    expect(routeFor({ id: '1', state: 'failed' })).toBe('/app/artworks/1/review');
    expect(routeFor({ id: '1', state: 'approved' })).toBe('/app/artworks/1/story');
    expect(routeFor({ id: '1', state: 'processing' })).toBe('/app/artworks/1');
  });
});

describe('S4 목록·상세(T080)', () => {
  it('작품이 없으면 빈 안내, 아이가 없으면 올리기는 사유 달린 비활성', async () => {
    serve({ '/v1/artworks': [], '/v1/children': [] });
    const w = await open(ArtworksView, '/app');
    expect(w.text()).toContain(ko.list.empty);
    expect(btn(w, ko.shell.appMenu.upload)!.attributes('aria-disabled')).toBe('true');
    w.unmount();
  });
  it('상태 배지와 다음 행동을 보이고 아이 별칭을 붙인다', async () => {
    serve({
      '/v1/artworks': [{ id: '7', childId: '1', state: 'awaiting_confirm', updatedAt: 'x', title: null }, { id: '8', childId: '1', state: 'failed', updatedAt: 'x', title: '해와 집' }],
      '/v1/children': [{ id: '1', alias: '하늘' }],
    });
    const w = await open(ArtworksView, '/app');
    expect(w.text()).toContain('하늘');
    expect(w.text()).toContain(ko.state.not_delivered);
    expect(w.find('a[href="/app/artworks/7/confirm"]').exists()).toBe(true);
    expect(w.text()).toContain(ko.list.toConfirm);
    w.unmount();
  });
  it('처리하지 못함은 G9 블록으로 "낮춘 결과가 아니에요"를 말한다', async () => {
    serve({ '/v1/artworks/7': { ...base, state: 'failed', confirmedKind: 'relief', stages: [{ stage: 'depth_relief', status: 'failed', attempt: 3 }] } });
    const w = await open(ArtworkDetailView, '/app/artworks/7');
    expect(w.find('[data-gate="G9"]').text()).toContain('낮춘 결과가 아니에요');
    expect(w.text()).toContain(ko.list.retried(2));
    w.unmount();
  });
});

describe('S2 올리기(T066)', () => {
  it('아이가 하나면 미리 고르고, 사진 전에는 사유 달린 비활성, 20MB 넘으면 G5', async () => {
    serve({ '/v1/children': [{ id: '1', alias: '하늘' }] });
    const w = await open(UploadView, '/app/upload');
    expect((w.find('#up-child').element as HTMLSelectElement).value).toBe('1');
    expect(btn(w, ko.upload.submit)!.text()).toContain(ko.upload.needPhoto);
    const input = w.findAll('input[type="file"]')[1]!;
    const big = new File([new Uint8Array(1)], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    Object.defineProperty(input.element, 'files', { value: [big], configurable: true });
    await input.trigger('change');
    expect(w.find('[data-gate="G5"]').exists()).toBe(true);
    expect(btn(w, ko.upload.submit)!.text()).toContain(ko.upload.tooBig);
    w.unmount();
  });
  it('올리면 multipart + Idempotency-Key로 보내고 S3로 간다', async () => {
    serve({ '/v1/children': [{ id: '1', alias: '하늘' }], 'POST /v1/artworks': () => json({ ...base, state: 'awaiting_confirm' }, 202) });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
    const w = await open(UploadView, '/app/upload');
    const input = w.findAll('input[type="file"]')[1]!;
    Object.defineProperty(input.element, 'files', { value: [new File([new Uint8Array(8)], 'a.png', { type: 'image/png' })], configurable: true });
    await input.trigger('change');
    await btn(w, ko.upload.submit)!.trigger('click');
    await flushPromises();
    const [, init] = calls('POST', '/v1/artworks')[0]!;
    expect((init!.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect((init!.body as FormData).get('childId')).toBe('1');
    expect(router.currentRoute.value.path).toBe('/app/artworks/7/confirm');
    w.unmount();
  });
});

describe('S3 확정(T067)', () => {
  const disabled = { ...base, state: 'awaiting_confirm', suggestion: 'none', choices: ['frame'],
    unavailableChoices: [{ choice: 'animated', reason: 'model_disabled' }, { choice: 'relief', reason: 'model_disabled' }] };
  it('판정 모델 비활성(판정 단계 없음): G7 블록 없이 안내 한 줄, 비활성 선택지는 사유 달린 C3, 기본 선택 없음', async () => {
    serve({ '/v1/artworks/7': disabled });
    const w = await open(ConfirmView, '/app/artworks/7/confirm');
    expect(w.find('[data-gate="G7"]').exists()).toBe(false);
    expect(w.text()).toContain(ko.confirm.noSuggestion);
    expect(btn(w, ko.kind.animated!)!.attributes('aria-disabled')).toBe('true');
    expect(btn(w, ko.kind.animated!)!.text()).toContain(ko.review.unavailable.model_disabled);
    expect(w.findAll('.chip-opt[aria-pressed="true"]')).toHaveLength(0);
    expect(btn(w, ko.confirm.submit)!.text()).toContain(ko.confirm.pickOne);
    w.unmount();
  });
  it('판정 소진(판정 단계가 있었음)이면 G7 블록', async () => {
    serve({ '/v1/artworks/7': { ...disabled, stages: [{ stage: 'judge', status: 'failed', attempt: 3 }] } });
    const w = await open(ConfirmView, '/app/artworks/7/confirm');
    expect(w.find('[data-gate="G7"]').exists()).toBe(true);
    w.unmount();
  });
  it('원본 액자를 골라 확정하면 frame을 보내고 진행 상세로', async () => {
    serve({ '/v1/artworks/7': disabled, 'POST /v1/artworks/7/confirm': () => json({ ...disabled, state: 'processing', confirmedKind: 'frame' }) });
    const w = await open(ConfirmView, '/app/artworks/7/confirm');
    await w.find('.chip-opt').trigger('click');
    await btn(w, ko.confirm.submit)!.trigger('click');
    await flushPromises();
    expect(JSON.parse(String(calls('POST', '/v1/artworks/7/confirm')[0]![1]!.body))).toEqual({ kind: 'frame' });
    expect(router.currentRoute.value.fullPath).toBe('/app/artworks/7?started=1');
    w.unmount();
  });
  it('이미 확정한 작품은 그 상태 화면으로 보낸다', async () => {
    serve({ '/v1/artworks/7': { ...base, state: 'awaiting_review' } });
    const w = await open(ConfirmView, '/app/artworks/7/confirm');
    expect(router.currentRoute.value.path).toBe('/app/artworks/7/review');
    w.unmount();
  });
});

describe('S5 결과 확인(T094)', () => {
  const frameResult = { ...base, state: 'awaiting_review', choices: ['like', 'retake'], result: { kind: 'frame', primaryUrl: null } };
  it('액자 결과: 좋아요·다시 찍기, 좋아요 → 이야기(승인 안내)', async () => {
    serve({ '/v1/artworks/7': frameResult, 'POST /v1/artworks/7/decision': () => json({ artwork: { ...frameResult, state: 'approved' }, alreadyDecided: false }) });
    const w = await open(ReviewView, '/app/artworks/7/review');
    await btn(w, ko.review.decision.like!)!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/app/artworks/7/story?approved=1');
    w.unmount();
  });
  it('다시 찍기는 확인 창 뒤에만 보내고, 응답 artwork가 null이어도 S2로(아이 미리 선택)', async () => {
    serve({ '/v1/artworks/7': frameResult, 'POST /v1/artworks/7/decision': () => json({ artwork: null, alreadyDecided: false, retake: { childId: '1' } }) });
    const w = await open(ReviewView, '/app/artworks/7/review');
    await btn(w, ko.review.decision.retake!)!.trigger('click');
    expect(calls('POST', '/v1/artworks/7/decision')).toHaveLength(0);
    expect(w.text()).toContain(ko.review.retakeBody);
    await w.find('[role="alertdialog"] .btn-primary').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/app/upload?child=1&retakeOf=7');
    w.unmount();
  });
  it('처리하지 못함: G9 블록, 좋아요는 사유 달린 비활성', async () => {
    serve({ '/v1/artworks/7': { ...base, state: 'failed', choices: ['frame', 'retake'], unavailableChoices: [{ choice: 'like', reason: 'needs_result' }] } });
    const w = await open(ReviewView, '/app/artworks/7/review');
    expect(w.find('[data-gate="G9"]').exists()).toBe(true);
    expect(btn(w, ko.review.decision.like!)!.text()).toContain(ko.review.unavailable.needs_result);
    w.unmount();
  });
  it('낮춘 결과는 C6 안내로 숨기지 않는다', async () => {
    serve({ '/v1/artworks/7': { ...frameResult, downgrade: 'relief_to_frame' } });
    const w = await open(ReviewView, '/app/artworks/7/review');
    expect(w.text()).toContain(ko.downgradeNote('입체 부조', '원본 액자'));
    w.unmount();
  });
});

describe('S6 이야기(T095)', () => {
  const approved = { ...base, state: 'approved', story: { updatedAt: '2026-09-29T01:00:00.000Z', title: null, madeOn: null, ageAtMaking: null, childWords: null } };
  it('미래 날짜는 사유 달린 비활성, 한마디는 적은 그대로·baseUpdatedAt을 실어 저장, 전시 되면 안내', async () => {
    serve({ '/v1/artworks/7': approved, 'PUT /v1/artworks/7/story': () => json({ ...approved, state: 'exhibited', story: { ...approved.story, title: '강아지' } }) });
    const w = await open(StoryView, '/app/artworks/7/story');
    await w.find('#st-date').setValue('2999-01-01');
    expect(btn(w, ko.story.save)!.text()).toContain(ko.story.fixDate);
    await w.find('#st-date').setValue('2026-09-01');
    await w.find('#st-title').setValue('강아지');
    await w.find('#st-age').setValue('6');
    await w.find('#st-words').setValue('  멍멍이가 웃어 ');
    await btn(w, ko.story.save)!.trigger('click');
    await flushPromises();
    const body = JSON.parse(String(calls('PUT', '/v1/artworks/7/story')[0]![1]!.body));
    expect(body).toMatchObject({ title: '강아지', madeOn: '2026-09-01', ageAtMaking: 6, childWords: '  멍멍이가 웃어 ', baseUpdatedAt: '2026-09-29T01:00:00.000Z' });
    expect(w.text()).toContain(ko.story.exhibited);
    w.unmount();
  });
  it('다른 보호자가 먼저 고쳤으면(409 story_conflict) 최신을 불러오고 내 입력을 옆에 남긴다', async () => {
    serve({ '/v1/artworks/7': approved, 'PUT /v1/artworks/7/story': () => problem(409, { code: 'conflict', reason: 'story_conflict', gate: 'G11' }) });
    const w = await open(StoryView, '/app/artworks/7/story');
    await w.find('#st-title').setValue('내 제목');
    await btn(w, ko.story.save)!.trigger('click');
    await flushPromises();
    expect(w.find('[data-gate="G11"]').exists()).toBe(true);
    expect(w.text()).toContain(ko.story.mine);
    expect(w.text()).toContain('내 제목');
    w.unmount();
  });
});

describe('S8 가족 전시(T096)', () => {
  it('연령 묶음으로 보이고 낮춤 표시가 없으며, 작품을 열면 한마디가 먼저 보인다', async () => {
    serve({
      '/v1/children': [{ id: '1', alias: '하늘' }],
      '/v1/gallery': { childId: '1', groups: [{ ageAtMaking: 6, items: [{ id: '7', kind: 'frame', originalUrl: '/v1/files/o', title: '강아지', madeOn: '2026-09-01', ageAtMaking: 6, childWords: '멍멍이가 웃어' }] }] },
    });
    const w = await open(GalleryView, '/app/gallery');
    await flushPromises();
    expect(w.text()).toContain(ko.gallery.age(6));
    expect(w.text()).not.toContain('바꿨어요');
    await w.find('button.art').trigger('click');
    expect(w.find('.quote').text()).toContain('멍멍이가 웃어');
    w.unmount();
  });
  it('전시 작품이 없으면 빈 안내와 작품 올리기', async () => {
    serve({ '/v1/children': [{ id: '1', alias: '하늘' }], '/v1/gallery': { childId: '1', groups: [] } });
    const w = await open(GalleryView, '/app/gallery');
    await flushPromises();
    expect(w.text()).toContain(ko.gallery.empty);
    w.unmount();
  });
});

describe('S0o 팀원 로그인(T055)', () => {
  it('팀원 API로 로그인하고 next로 간다 — 가입·보호자 링크 없음', async () => {
    serve({ 'POST /v1/ops/auth/login': () => json({ roles: ['operator'] }), '/v1/ops/me': { emailMasked: 'a***', roles: ['operator'] } });
    const w = await open(OpsLoginView, '/ops/login?next=/ops/models');
    expect(w.find('a[href^="/app"]').exists()).toBe(false);
    await w.find('#ol-email').setValue('ops@ex.com');
    await w.find('#ol-pw').setValue('12345678');
    await btn(w, ko.auth.login)!.trigger('click');
    await flushPromises();
    expect(calls('POST', '/v1/ops/auth/login')).toHaveLength(1);
    expect(router.currentRoute.value.fullPath).toBe('/ops/models');
    w.unmount();
  });
  it('불일치는 G1 블록, 로그인 화면으로 다시 보내지 않는다', async () => {
    serve({ 'POST /v1/ops/auth/login': () => problem(401, { code: 'unauthorized', reason: 'bad_credentials', gate: 'G1' }) });
    const w = await open(OpsLoginView, '/ops/login');
    await w.find('#ol-email').setValue('ops@ex.com');
    await w.find('#ol-pw').setValue('wrong-pass');
    await btn(w, ko.auth.login)!.trigger('click');
    await flushPromises();
    expect(w.find('[data-gate="G1"]').exists()).toBe(true);
    w.unmount();
  });
});
