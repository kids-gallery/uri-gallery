// 홈 고전 미술관 시안 A · B(D30, SD_02 §17-5): 전환은 museumTheme.ts 한 줄(VITE_MUSEUM_THEME로 덮어씀),
// 전시실 이름은 나이 어린 순 "제N전시실 · N살", 황동 설명판을 누르면 작품 앞, 안내도는 방 칸 + 현재 위치 + 입구, 빈 상태.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import ClassicHomeView from '../app/views/ClassicHomeView.vue';
import { MUSEUM_THEME_DEFAULT, museumTheme, roomLabel, roomNumbers } from '../app/museumTheme';
import { ko } from '../copy/ko';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
let router: Router;
beforeEach(() => {
  setActivePinia(createPinia());
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); document.body.innerHTML = ''; });

function serve(gallery: unknown, children = [{ id: '1', alias: '하늘' }], artworks: unknown[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = String(url).split('?')[0];
    if (path === '/v1/children') return json(children);
    if (path === '/v1/gallery') return json(gallery);
    if (path === '/v1/artworks') return json(artworks);
    return new Response('{}', { status: 404 });
  }));
}
async function open() {
  await router.push('/app'); await router.isReady();
  const w = mount(ClassicHomeView, { global: { plugins: [router], stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' } } }, attachTo: document.body });
  await flushPromises();
  return w;
}
const item = (id: string, age: number, madeOn: string, title: string) => ({ id, kind: 'frame', originalUrl: `/v1/files/${id}`, title, madeOn, ageAtMaking: age, childWords: null });
const gal = { childId: '1', groups: [
  { ageAtMaking: 7, items: [item('3', 7, '2026-05-01', '바다')] },
  { ageAtMaking: 5, items: [item('1', 5, '2024-03-01', '해님'), item('2', 5, '2024-01-10', '꽃')] },
  { ageAtMaking: 6, items: [item('4', 6, '2025-02-01', '강아지')] },
] };

describe('시안 전환(museumTheme.ts 한 줄)', () => {
  it('기본값은 한 줄 설정, VITE_MUSEUM_THEME로 덮어쓰고 모르는 값은 기본값', () => {
    vi.stubEnv('VITE_MUSEUM_THEME', '');
    expect(museumTheme()).toBe(MUSEUM_THEME_DEFAULT);
    vi.stubEnv('VITE_MUSEUM_THEME', 'classic-b');
    expect(museumTheme()).toBe('classic-b');
    vi.stubEnv('VITE_MUSEUM_THEME', 'gold');
    expect(museumTheme()).toBe(MUSEUM_THEME_DEFAULT);
  });
  it('전시실 번호는 나이 어린 순 1부터, 이름은 v2 "N세관" · 고전 "제N전시실 · N살"', () => {
    const no = roomNumbers([{ ageAtMaking: 7 }, { ageAtMaking: 5 }, { ageAtMaking: 6 }]);
    expect([no.get(5), no.get(6), no.get(7)]).toEqual([1, 2, 3]);
    expect(roomLabel(1, 6, 'v2')).toBe('6세관');
    expect(roomLabel(1, 6, 'classic-a')).toBe('제1전시실 · 6살');
    expect(roomLabel(3, 7, 'classic-b')).toBe('제3전시실 · 7살');
  });
});

describe.each(['classic-a', 'classic-b'] as const)('홈 고전 시안 %s', (t) => {
  beforeEach(() => vi.stubEnv('VITE_MUSEUM_THEME', t));
  it('아치 간판 · 로비 최근 작품(액자 종류) · 안내도(나이 순 방 칸 + 현재 위치 + 입구) · 전시실(제작일 순)', async () => {
    serve(gal, [{ id: '1', alias: '하늘' }], [{ id: '9', childId: '1', state: 'processing', updatedAt: 'x' }]);
    const w = await open();
    expect(w.find('.mc').attributes('data-mc')).toBe(t === 'classic-b' ? 'b' : 'a');
    expect(w.find('.mc-sign h1').text()).toBe(ko.museum.hall('하늘'));
    expect(w.find('.mc-lobby .artframe').classes()).toContain(t === 'classic-b' ? 'v-gold' : 'v-bw');
    expect(w.find('.mc-lobby .mc-plaque').text()).toContain('바다');
    expect(w.findAll('.mc-cell b').map((b) => b.text())).toEqual(['제1전시실', '제2전시실', '제3전시실']);
    expect(w.findAll('.mc-cell span:not(.no)').map((s) => s.text())).toEqual([ko.classic.cell(5, 2), ko.classic.cell(6, 1), ko.classic.cell(7, 1)]);
    expect(w.find('.mc-here').text()).toContain(ko.classic.here);
    expect(w.find('.mc-door-l').text()).toBe(ko.museum.entrance);
    expect(w.findAll('.mc-arch h2').map((h) => h.text())).toEqual(['제1전시실', '제2전시실', '제3전시실']);
    expect(w.find('#mc-room-1 .mc-arch p').text()).toBe(ko.classic.roomLine(5, 2, '2024-01-10'));
    expect(w.findAll('#mc-room-1 .mc-plaque b').map((b) => b.text())).toEqual(['꽃', '해님']);
    expect(w.findAll('.mc-wall[data-tone]').map((e) => e.attributes('data-tone'))).toEqual(['1', '1', '2', '3']);
    expect(w.text()).toContain(ko.museum.preparing(1));
    expect(w.text()).not.toContain('세관');
    w.unmount();
  });
  it('황동 설명판을 누르면 작품 앞(/app/hall?art=) — 크게 보기 + 한마디', async () => {
    serve(gal);
    const w = await open();
    const plaque = w.findAll('#mc-room-2 .mc-plaque')[0]!;
    expect(plaque.attributes('aria-label')).toBe(ko.classic.plaqueOpen('강아지'));
    await plaque.trigger('click'); await flushPromises();
    expect(router.currentRoute.value.path).toBe('/app/hall');
    expect(router.currentRoute.value.query).toMatchObject({ child: '1', art: '4' });
    w.unmount();
  });
  it('작품이 없으면 빈 액자와 "첫 그림을 걸어 볼까요?", 안내도 · 전시실은 없음', async () => {
    serve({ childId: '1', groups: [] });
    const w = await open();
    expect(w.text()).toContain(ko.museum.emptyTitle);
    expect(w.find('.mc-map').exists()).toBe(false);
    expect(w.find('.mc-room').exists()).toBe(false);
    w.unmount();
  });
});
