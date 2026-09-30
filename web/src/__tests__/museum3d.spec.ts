// 아이 미술관 CSS 3D(D40, SD_02 §17-13 B · C · F): 방 나누기(최소 2 · 최대 8 · 묶음) · 나이 미정 = 1번 방 · 입체는 진열대 ·
// 방문자는 나이 · 날짜 없이 "전시실 N" · 벽 충돌 · 길 찾기 · 화면 한 점 → 바닥 · 문구 규칙 · 화면 올리기(가짜 fetch).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  areaOf, ARCH_TOP, buildMuseumLayout, canStand, clampMove, clampPitch, domEstimate, EYE, FOV_DEG, HALL_H, HALL_HALF, MAX_ROOMS, MIN_PLINTHS, LOBBY_STATUE_X, LOBBY_STATUE_Z,
  nearestTarget, pathTo, perspectiveFor, ROOM_H, screenToFloor,
  type MuseumInput, type MuseumItem,
} from '../app/museum3d/layout';
import { fromGallery, fromVisit, type VisitGallery } from '../app/museum3d/adapters';
import { m3 } from '../app/museum3d/copy';
import Museum3DView from '../app/views/Museum3DView.vue';

const it_ = (id: string, kind: MuseumItem['kind'] = 'frame'): MuseumItem => ({ id, kind, title: `그림 ${id}`, imageUrl: `/f/${id}` });
const input = (groups: MuseumInput['groups'], visitor = false): MuseumInput => ({ childAlias: '하늘', visitor, groups });

describe('방 나누기', () => {
  it('구역이 하나여도 방은 최소 2개(빈 방은 "다음 전시실")', () => {
    const L = buildMuseumLayout(input([{ label: '5살 전시실', age: 5, items: [it_('a')] }]));
    expect(L.rooms).toHaveLength(2);
    expect(L.rooms[1]!.label).toBe(m3.emptyRoom);
    expect(buildMuseumLayout(input([])).rooms).toHaveLength(2);
  });
  it('8개를 넘으면 오래된 구역을 마지막 방에 묶는다', () => {
    const groups = Array.from({ length: 11 }, (_, i) => ({ label: `${11 - i}살 전시실`, age: 11 - i, items: [it_(`x${i}`)] }));
    const L = buildMuseumLayout(input(groups));
    expect(L.rooms).toHaveLength(MAX_ROOMS);
    expect(L.rooms[7]!.label).toBe(m3.mergedAges(1, 4));
    expect(L.rooms[7]!.count).toBe(4);
    expect(L.frames).toHaveLength(11);
  });
  it('방은 홀 양옆에 번갈아(1 왼쪽 · 2 오른쪽), 8×8m · 홀 폭 12m · 층고 7m 이상 · 문 아치 4m(D45)', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('a')] }, { label: 'b', items: [it_('b')] }, { label: 'c', items: [it_('c')] }]));
    expect(L.rooms.map((r) => r.side)).toEqual([-1, 1, -1]);
    for (const r of L.rooms) { expect(r.rect.x1 - r.rect.x0).toBe(8); expect(r.rect.z1 - r.rect.z0).toBe(8); }
    expect(L.hall.x1 - L.hall.x0).toBe(12);
    expect(Math.min(ROOM_H, HALL_H)).toBeGreaterThanOrEqual(7);
    expect(ARCH_TOP).toBe(4);
    expect(L.rooms[2]!.rect.z0).toBe(L.rooms[0]!.rect.z1);
  });
  it('나이 미정은 1번 방(가족 전시 응답에서)', () => {
    const gi = (id: string, age: number | null) => ({ id, kind: 'frame' as const, originalUrl: `/o/${id}`, photoUrl: `/p/${id}`, title: id, madeOn: '2026-01-01', ageAtMaking: age });
    const inp = fromGallery({ childId: '1', groups: [{ ageAtMaking: 4, items: [gi('a', 4)] }, { ageAtMaking: 6, items: [gi('b', 6)] }, { ageAtMaking: null, items: [gi('n', null)] }] }, { alias: '하늘' });
    const L = buildMuseumLayout(inp);
    expect(L.rooms.map((r) => r.label)).toEqual([m3.noAgeRoom, m3.ageRoom(6), m3.ageRoom(4)]);
    expect(L.frames[0]!.item.imageUrl).toBe('/p/n'); // 액자 그림 = 고친 사진(photoUrl)
  });
  it('벽 3면에 최대 3점씩, 넘치면 숨긴 수만 센다', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: Array.from({ length: 12 }, (_, i) => it_(`k${i}`)) }]));
    expect(L.rooms[0]!.frames).toHaveLength(9);
    expect(L.rooms[0]!.hidden).toBe(3);
  });
});

describe('진열대 · 동상', () => {
  it('입체(relief)는 진열대 유리 상자에, 벽에는 걸지 않는다', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('f1'), it_('r1', 'relief'), it_('f2')] }]));
    expect(L.pedestals[0]!.item?.id).toBe('r1');
    expect(L.pedestals[0]!.planes.some((p) => p.cls === 'glass')).toBe(true);
    expect(L.frames.map((f) => f.item.id)).toEqual(['f1', 'f2']);
  });
  it('입체가 없으면 빈 받침 + "입체로 만들면 여기에 놓여요"', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('f1')] }]));
    expect(L.pedestals[0]!.item).toBeNull();
    expect(L.pedestals[0]!.planes.find((p) => p.cls === 'note')?.text).toBe(m3.pedestalEmpty);
  });
  it('로비 가운데 캐릭터 동상, 방 문 양옆은 첫 작품 조각상 · 비면 화분', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('f1')] }]));
    expect(L.statues.find((s) => s.room === -1)?.kind).toBe('character');
    expect(L.rooms[0]!.statues.map((s) => s.kind)).toEqual(['art', 'plant']);
    expect(L.rooms[1]!.statues.map((s) => s.kind)).toEqual(['plant', 'plant']);
  });
  it('끝벽 큰 벽화 1 + 요소 수가 적당하다(최대 8방 · 80점도 ~500 아래)', () => {
    const groups = Array.from({ length: 8 }, (_, i) => ({ label: `${i}`, items: Array.from({ length: 10 }, (_, k) => it_(`${i}-${k}`, k === 0 ? 'relief' : 'frame')) }));
    const L = buildMuseumLayout(input(groups));
    expect(L.murals.filter((m) => m.big)).toHaveLength(1);
    expect(domEstimate(L)).toBeLessThan(500);
    expect(domEstimate(buildMuseumLayout(input([{ label: 'a', items: [it_('a')] }])))).toBeLessThan(200);
  });
});

describe('가운데 홀 받침대(D45)', () => {
  it('만들기 작품이 없어도 빈 받침대 2개(점선 + 안내)', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('f1')] }]));
    expect(L.plinths).toHaveLength(MIN_PLINTHS);
    for (const p of L.plinths) {
      expect(p.item).toBeNull();
      expect(p.planes.find((q) => q.cls === 'note')?.text).toBe(m3.plinthEmpty);
      expect(p.planes.some((q) => q.cls.includes('empty'))).toBe(true);
    }
    expect(new Set(L.plinths.map((p) => p.side))).toEqual(new Set([-1, 1])); // 양옆 번갈아
  });
  it('방 진열대 다음의 만들기 작품(relief · sculpture · making 표시)은 홀 받침대로, 명패는 제목', () => {
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('r1', 'relief'), it_('f1'), it_('s1', 'sculpture'), { ...it_('m1'), making: true }, it_('r2', 'relief')] }]));
    expect(L.pedestals[0]!.item?.id).toBe('r1');
    expect(L.plinths.map((p) => p.item?.id)).toEqual(['s1', 'm1', 'r2']);
    expect(L.frames.map((f) => f.item.id)).toEqual(['f1']);
    expect(L.plinths[0]!.planes.find((q) => q.cls === 'plaque')?.text).toBe('그림 s1');
    for (const p of L.plinths) { expect(Math.abs(p.x)).toBeLessThan(HALL_HALF); expect(canStand(L, p.pose.x, p.pose.z)).toBe(true); expect(canStand(L, p.x, p.z)).toBe(false); }
  });
});

describe('어지럽지 않은 조작(D45)', () => {
  it('위아래는 ±25°까지, 화각은 60~70°', () => {
    expect(clampPitch(40)).toBe(25); expect(clampPitch(-90)).toBe(-25); expect(clampPitch(10)).toBe(10);
    expect(FOV_DEG).toBeGreaterThanOrEqual(60); expect(FOV_DEG).toBeLessThanOrEqual(70);
    const P = perspectiveFor(1440, 800);
    expect((2 * Math.atan(720 / P) * 180) / Math.PI).toBeCloseTo(FOV_DEG);
  });
});

describe('방문자(§17-13 F)', () => {
  const visit: VisitGallery = {
    child: { id: '9', alias: '바다', character: 'fox', color: 'sky', museumStyle: 'hanok_roof' },
    rooms: [
      { room: 2, items: [{ id: 'm', kind: 'animated', title: '춤', primaryUrl: '/v1/visit/files/mp4', auxUrl: '/v1/visit/files/pic' }] },
      { room: 1, items: [{ id: 'f', kind: 'frame', title: null, primaryUrl: '/v1/visit/files/f', auxUrl: null }, { id: 'r', kind: 'relief', title: '곰', primaryUrl: '/v1/visit/files/depth', auxUrl: '/v1/visit/files/cut' }] },
    ],
  };
  it('방 이름은 "전시실 N", 나이 · 한마디 · 날짜가 없다', () => {
    const inp = fromVisit(visit);
    const L = buildMuseumLayout(inp);
    expect(L.visitor).toBe(true);
    expect(L.rooms.map((r) => r.label)).toEqual([m3.visitRoom(1), m3.visitRoom(2)]);
    const text = JSON.stringify(L);
    expect(text).not.toMatch(/살 전시실|나이|madeOn|childWords|guardianNote|\d{4}-\d{2}-\d{2}/);
  });
  it('방문 파일 뜻: 액자 = primaryUrl · 움직이는 그림 = auxUrl 그림 + primaryUrl 영상 · 입체 = auxUrl 컷아웃', () => {
    const L = buildMuseumLayout(fromVisit(visit));
    const all = [...L.frames.map((f) => f.item), ...L.pedestals.flatMap((p) => (p.item ? [p.item] : []))];
    const by = (id: string) => all.find((x) => x.id === id)!;
    expect(by('f').imageUrl).toBe('/v1/visit/files/f');
    expect(by('m').imageUrl).toBe('/v1/visit/files/pic');
    expect(by('m').videoUrl).toBe('/v1/visit/files/mp4');
    expect(by('r').imageUrl).toBe('/v1/visit/files/cut');
    expect(L.pedestals[0]!.item?.id).toBe('r');
  });
  it('방문자 모드는 가족이 준 나이 이름도 번호로 바꾼다', () => {
    const L = buildMuseumLayout(input([{ label: '5살 전시실', age: 5, items: [it_('a')] }], true));
    expect(L.rooms[0]!.label).toBe(m3.visitRoom(1));
  });
});

describe('걷기 · 충돌 · 길', () => {
  const L = buildMuseumLayout(input([{ label: 'a', items: [it_('a')] }, { label: 'b', items: [it_('b')] }, { label: 'c', items: [it_('c')] }]));
  it('홀 · 방 안은 설 수 있고 벽 밖 · 동상 자리는 못 선다', () => {
    expect(canStand(L, 0, 1)).toBe(true);
    expect(canStand(L, LOBBY_STATUE_X, LOBBY_STATUE_Z)).toBe(false); // 로비 동상
    expect(Math.hypot(LOBBY_STATUE_X - L.start.x, LOBBY_STATUE_Z - L.start.z)).toBeGreaterThanOrEqual(5); // 입구에서 5m 넘게 앞(작은 실제 크기로 보인다)
    expect(L.hallEntry.yaw).toBe(0); // 홀 버튼 = 홀 긴 축을 본다
    for (const r of L.rooms) expect(r.entry.pitch).toBeGreaterThan(0);
    expect(canStand(L, L.rooms[0]!.center.x, L.rooms[0]!.center.z + 2)).toBe(true); // 방 안
    expect(canStand(L, -HALL_HALF, L.rooms[0]!.rect.z0 + 0.2)).toBe(false); // 문 아닌 벽
    expect(canStand(L, -HALL_HALF, L.rooms[0]!.center.z)).toBe(true); // 문
    expect(canStand(L, 30, 5)).toBe(false);
    expect(canStand(L, 0, -1)).toBe(false);
  });
  it('벽에 막히면 미끄러지고, 안으로 못 들어가면 그 자리', () => {
    const p = clampMove(L, { x: HALL_HALF - 0.5, z: 2 }, { x: HALL_HALF + 0.5, z: 2.4 });
    expect(p).toEqual({ x: HALL_HALF - 0.5, z: 2.4 });
    expect(clampMove(L, { x: 0, z: 0.5 }, { x: 0, z: -1 })).toEqual({ x: 0, z: 0.5 });
  });
  it('다른 방으로 갈 때는 문을 지난다', () => {
    const a = L.rooms[0]!; const b = L.rooms[1]!;
    expect(areaOf(L, a.center)).toBe(0);
    expect(areaOf(L, { x: 0, z: 1 })).toBe('lobby');
    const path = pathTo(L, { x: a.center.x, z: a.center.z + 2 }, { x: b.center.x, z: b.center.z - 2 });
    expect(path).toEqual([a.door.inside, a.door.hall, b.door.hall, b.door.inside, { x: b.center.x, z: b.center.z - 2 }]);
    expect(pathTo(L, { x: 0, z: 1 }, { x: 1, z: 8 })).toEqual([{ x: 1, z: 8 }]);
  });
  it('방 버튼 · 로비 · 홀 · 받침대 앞 자리는 모두 설 수 있다', () => {
    for (const p of L.plinths) expect(canStand(L, p.pose.x, p.pose.z)).toBe(true);
    for (const p of [L.start, L.hallEntry, ...L.rooms.map((r) => r.entry)]) expect(canStand(L, p.x, p.z)).toBe(true);
  });
  it('액자 앞 서는 자리는 설 수 있고, 거기서 그 액자가 가까운 작품이다', () => {
    for (const f of L.frames) {
      expect(canStand(L, f.pose.x, f.pose.z)).toBe(true);
      expect(nearestTarget(f.pose, L.frames)?.key).toBe(f.key);
    }
  });
  it('화면 가운데 아래를 누르면 앞쪽 바닥', () => {
    const hit = screenToFloor({ x: 0, z: 1, yaw: 0, pitch: 0 }, 0, 155, 1000)!;
    expect(hit.x).toBeCloseTo(0); expect(hit.z).toBeCloseTo(1 + (EYE * 1000) / 155);
    const turned = screenToFloor({ x: 0, z: 1, yaw: 90, pitch: 0 }, 0, 155, 1000)!;
    expect(turned.x).toBeLessThan(0); expect(turned.z).toBeCloseTo(1);
    expect(screenToFloor({ x: 0, z: 1, yaw: 0, pitch: 0 }, 0, -50, 1000)).toBeNull(); // 위(천장)는 바닥 아님
  });
});

describe('문구 규칙', () => {
  it('copy.ts에 점수 · 확률 · % · 실패했 · ! 가 없다', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/app/museum3d/copy.ts'), 'utf8').replace(/^\/\/.*$/gm, '');
    for (const bad of ['점수', '확률', '%', '실패했', '!']) expect(src.includes(bad), bad).toBe(false);
  });
});

describe('Museum3DView 올리기', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const mk = async (url: string) => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/app/museum/:childId', component: Museum3DView }, { path: '/app/town', component: { template: '<div>town</div>' } },
      { path: '/:p(.*)*', component: { template: '<div />' } }] });
    await router.push(url); await router.isReady();
    // 움직이게 물어보기(AnimateAsk, 팀원 컴포넌트)는 흉내: ready를 보이고 누르면 closed
    const AnimateAsk = { props: ['artworkId', 'overlay', 'ready'], emits: ['closed'], template: '<button class="ask-stub" :data-ready="String(ready)" @click="$emit(\'closed\')">ask</button>' };
    const w = mount({ template: '<RouterView />' }, { global: { plugins: [router], stubs: { AnimateAsk } }, attachTo: document.body });
    await flushPromises(); await flushPromises();
    return { w, router };
  };

  it('가족: 장면 이름 · 작품 버튼 · 방 이름 · 미니맵 · [밖으로]', async () => {
    const fetch = vi.fn(async (u: string) => {
      if (u.startsWith('/v1/children')) return json([{ id: '7', alias: '하늘', character: 'cat', color: 'peach', museumStyle: null }]);
      if (u.startsWith('/v1/gallery')) return json({ childId: '7', groups: [
        { ageAtMaking: 5, items: [{ id: 'a1', kind: 'frame', originalUrl: '/o', photoUrl: '/p', title: '해님', madeOn: '2026-05-01', ageAtMaking: 5, childWords: '반짝' }] },
        { ageAtMaking: 6, items: [{ id: 'r1', kind: 'relief', originalUrl: '/o2', auxUrl: '/cut', title: '곰돌이', madeOn: '2026-08-01', ageAtMaking: 6 }] }] });
      return json({}, 404);
    });
    vi.stubGlobal('fetch', fetch);
    const { w, router } = await mk('/app/museum/7');
    expect(fetch.mock.calls.map((c) => c[0])).toContain('/v1/gallery?child=7');
    expect(w.find('[role=region]').attributes('aria-label')).toBe(m3.scene('하늘'));
    const arts = w.findAll('button[aria-label$="— 가까이 가기"]');
    expect(arts.map((b) => b.attributes('aria-label'))).toEqual([m3.artButton('해님'), m3.artButton('곰돌이')]);
    expect(w.text()).toContain(m3.ageRoom(6));
    expect(w.text()).toContain(m3.ageRoom(5));
    const bar = w.findAll('.m3-bar button');
    expect(bar.map((b) => b.text())).toEqual([m3.lobby, m3.hall, m3.ageRoom(6), m3.ageRoom(5)]);
    expect(bar[0]!.attributes('aria-current')).toBe('location');
    expect(w.find('.mm-small').exists()).toBe(true);
    await w.find('.mm-grow').trigger('click');
    const list = w.findAll('.mm-list button').map((b) => b.text());
    expect(list).toEqual([m3.lobby, m3.roomCount(m3.ageRoom(6), 1), m3.roomCount(m3.ageRoom(5), 1)]);
    expect(w.find('.m3-me').attributes('aria-hidden')).toBe('true'); // 아이 캐릭터(장식)
    await w.find('.m3-exit').trigger('click'); await flushPromises();
    expect(router.currentRoute.value.path).toBe('/app/town');
    w.unmount();
  });

  it('방문자: 방문 주소로 읽고 "전시실 N" · 이웃이 아니면 자물쇠 안내', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (u === '/v1/visit/children/9/gallery'
      ? json({ child: { id: '9', alias: '바다', character: null, color: null, museumStyle: null }, rooms: [{ room: 1, items: [{ id: 'f', kind: 'frame', title: '배', primaryUrl: '/v1/visit/files/t', auxUrl: null }] }] })
      : json({ code: 'not_found' }, 404))));
    const a = await mk('/app/museum/9?visit=1');
    expect(a.w.text()).toContain(m3.visitRoom(1));
    expect(a.w.text()).not.toContain('살 전시실');
    expect(a.w.find('.m3-me').exists()).toBe(false); // 방문자는 걷는 캐릭터 없음
    expect(a.w.find('[role=region]').attributes('aria-label')).toBe(m3.scene('바다'));
    a.w.unmount();
    const b = await mk('/app/museum/10?visit=1');
    expect(b.w.text()).toContain(m3.visitLocked);
    b.w.unmount();
  });

  it('걸리는 장면(D44 · D46): ?hung= 이면 주소에서 지우고, 장면이 끝나면 물어보기 → 닫으면 그 작품 크게 보기', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (u.startsWith('/v1/children')) return json([{ id: '7', alias: '하늘' }]);
      if (u.includes('/comments')) return json({ items: [], open: true, openUntil: '2026-10-07T00:00:00Z' });
      return json({ childId: '7', groups: [{ ageAtMaking: null, items: [{ id: 'n1', kind: 'frame', originalUrl: '/o', photoUrl: '/p', title: '새 그림', madeOn: '2026-09-30', ageAtMaking: null, childWords: null }] }] });
    }));
    const { w, router } = await mk('/app/museum/7?hung=n1&x=1');
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({ x: '1' });
    const ask = w.find('.ask-stub');
    expect(ask.attributes('data-ready')).toBe('true'); // 움직임 줄이기: 장면이 바로 끝남
    expect(document.body.querySelector('[role=dialog]')).toBeNull(); // 물어보기를 닫기 전에는 크게 보기를 열지 않는다
    await ask.trigger('click'); await flushPromises();
    expect(w.find('.ask-stub').exists()).toBe(false);
    expect(document.body.querySelector('[role=dialog]')?.textContent).toContain('새 그림');
    w.unmount();
  });
  it('물어보기가 없는 걸리는 장면 신호: 장면만 끝나면 hangDone', async () => {
    const { mount: m } = await import('@vue/test-utils');
    const Scene = (await import('../app/museum3d/Scene.vue')).default;
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('h1')] }]));
    const s = m(Scene, { props: { layout: L, hang: 'h1' }, attachTo: document.body });
    await flushPromises();
    expect(s.emitted('hangDone')?.[0]).toEqual(['h1']);
    expect((s.emitted('open')?.[0]?.[0] as MuseumItem).id).toBe('h1'); // openAfterHang 기본 true
    s.unmount();
  });
  it('도움말: 데스크톱은 " · "로 이은 네 가지, 터치는 키 이름 없이 두 가지', async () => {
    const Scene = (await import('../app/museum3d/Scene.vue')).default;
    const L = buildMuseumLayout(input([{ label: 'a', items: [it_('h1')] }]));
    const d = mount(Scene, { props: { layout: L, companion: false }, attachTo: document.body });
    expect(d.find('.m3-keys').text()).toBe(m3.keys.join(' · '));
    d.unmount();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} }));
    const t = mount(Scene, { props: { layout: L, companion: false }, attachTo: document.body });
    expect(t.find('.m3-keys').text()).toBe(m3.keys.slice(0, 2).join(' · '));
    expect(t.find('.m3-keys').text()).not.toMatch(/WASD|Shift/);
    t.unmount();
  });
  it('방문자 크게 보기: [들려주기]는 제목만, 저장 없음', async () => {
    const Viewer = (await import('../app/museum3d/Viewer.vue')).default;
    const v = mount(Viewer, { props: { item: { id: 'f', kind: 'frame', title: '배', imageUrl: '/v1/visit/files/t' }, alias: '바다' }, attachTo: document.body });
    expect(v.findComponent({ name: 'SpeakButton' }).props('parts')).toEqual(['배']);
    expect(v.text()).not.toMatch(/저장/);
    v.unmount();
  });
});
