// 3D미술관_재설계 §2-22 13 휴대폰 측정 표시: 프레임 간격 통계(가장 가까운 순위 백분위), 보고 글 모양, 다시 열림 판정,
// 이벤트 기록·10초 창·멈춤, 화면의 [값 복사]. 측정 표시가 일반 배포본에 없는지는 빌드 결과로 따로 확인한다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { FRAME_END, MEASURE, createMeasure, detectReopen, frameStats, frameWindow, readReopen, report, type MeasureState, type Reopen } from '@/app/world/measure';

/** requestAnimationFrame을 손으로 돌린다 */
function manualFrames() {
  let queue = new Map<number, FrameRequestCallback>(), id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.set(++id, cb); return id; });
  vi.stubGlobal('cancelAnimationFrame', (i: number) => { queue.delete(i); });
  const tick = (t: number) => { const due = [...queue.values()]; queue = new Map(); for (const cb of due) cb(t); };
  return { tick, run: (from: number, step: number, until: number) => { for (let t = from; t <= until; t += step) tick(t); }, pending: () => queue.size };
}
const send = (name: string) => window.dispatchEvent(new CustomEvent(MEASURE.event, { detail: name }));
function fakeStorage() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; }

describe('프레임 간격 통계', () => {
  it('값이 없으면 개수 0, 나머지는 NaN', () => {
    const x = frameStats([]);
    expect(x.n).toBe(0);
    expect([x.p50, x.p95, x.max].every(Number.isNaN)).toBe(true);
  });

  it('한 개면 셋 다 그 값', () => {
    expect(frameStats([16.7])).toEqual({ n: 1, p50: 16.7, p95: 16.7, max: 16.7 });
  });

  it('가장 가까운 순위: 오름차순 ceil(p×n/100)번째 값을 보간 없이 고른다', () => {
    expect(frameStats([40, 10, 30, 20])).toEqual({ n: 4, p50: 20, p95: 40, max: 40 }); // 2번째, ceil(3.8)=4번째
    expect(frameStats(Array.from({ length: 100 }, (_, i) => 100 - i))).toEqual({ n: 100, p50: 50, p95: 95, max: 100 });
    expect(frameStats(Array.from({ length: 20 }, (_, i) => i + 1))).toMatchObject({ p50: 10, p95: 19 });
  });

  it('긴 간격이 5% 이하면 p95는 평소 간격이고, 넘으면 긴 간격이다. 최대는 늘 가장 긴 간격', () => {
    expect(frameStats([...Array<number>(590).fill(16.7), ...Array<number>(10).fill(50)])).toEqual({ n: 600, p50: 16.7, p95: 16.7, max: 50 });
    expect(frameStats([...Array<number>(560).fill(16.7), ...Array<number>(40).fill(50)]).p95).toBe(50);
  });

  it('유한수가 아닌 값은 빼고, 넘긴 배열은 바꾸지 않는다', () => {
    const input = [33, Number.NaN, 16, Number.POSITIVE_INFINITY, 17];
    expect(frameStats(input)).toEqual({ n: 3, p50: 17, p95: 33, max: 33 });
    expect(input).toEqual([33, Number.NaN, 16, Number.POSITIVE_INFINITY, 17]);
  });

  it('창: 첫 시각부터 정한 시간을 채우면 끝나고, 간격 수는 시각 수보다 하나 적다', () => {
    const w = frameWindow(100);
    expect([1000, 1040, 1099].map((t) => w.push(t))).toEqual([false, false, false]);
    expect(w.push(1100)).toBe(true);
    expect(w.deltas).toEqual([40, 59, 1]);
    expect(w.elapsed()).toBe(100);
  });
});

describe('다시 열림 판정', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('같은 탭에서 두 번째로 열면 예, 첫 번째는 아니요', () => {
    const st = fakeStorage();
    expect(detectReopen(st, 'navigate')).toEqual({ loads: 1, navType: 'navigate', discarded: null, reopened: false });
    expect(detectReopen(st, 'navigate')).toMatchObject({ loads: 2, reopened: true });
  });

  it('처음이어도 reload이거나 크롬이 메모리 때문에 버린 탭이면 예', () => {
    expect(detectReopen(fakeStorage(), 'reload').reopened).toBe(true);
    expect(detectReopen(fakeStorage(), 'navigate', true)).toMatchObject({ discarded: true, reopened: true });
    expect(detectReopen(fakeStorage(), 'navigate', false)).toMatchObject({ discarded: false, reopened: false });
  });

  it('저장소가 막히면 횟수는 모르고, 다른 단서도 없으면 알 수 없음', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(detectReopen(blocked, 'navigate')).toEqual({ loads: null, navType: 'navigate', discarded: null, reopened: null });
    expect(detectReopen(null, 'reload').reopened).toBe(true);
    expect(detectReopen(null).navType).toBe('알 수 없음');
  });

  it('브라우저 값: sessionStorage에 횟수를 올리고 navigation 항목의 type을 읽는다', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'back_forward' }] as unknown as PerformanceEntryList);
    expect(readReopen()).toMatchObject({ loads: 1, navType: 'back_forward', reopened: false });
    expect(readReopen()).toMatchObject({ loads: 2, reopened: true });
    expect(sessionStorage.getItem(MEASURE.loadsKey)).toBe('2');
  });
});

describe('보고 글', () => {
  const first: Reopen = { loads: 1, navType: 'navigate', discarded: null, reopened: false };
  const info = { when: '2026. 10. 28. 오후 3:00:00', build: 'index-abc.js', device: 'iPhone · 화면 390×664 · 배율 3' };
  const state = (over: Partial<MeasureState> = {}): MeasureState => ({ marks: {}, frames: [], running: null, reopen: first, previous: null, ...over });

  it('값이 다 있으면 정해진 모양으로 한 줄씩 쓴다(시각은 이 탭을 연 때부터, 구간은 두 시각의 차)', () => {
    const s = state({
      marks: { 'title-shown': 1840, 'start-ready': 6210, 'start-pressed': 8020, inside: 11420, 'photo-picked': 24100, 'first-saved': 28200 },
      frames: [{ from: 'inside', end: 'done', ms: 10012, at: 21432, stats: { n: 598, p50: 16.7, p95: 33.4, max: 120.3 } }],
    });
    expect(report(s, info)).toEqual([
      '우리 아이 미술관 측정(설계 2-22 13)',
      '판: index-abc.js · 적은 때: 2026. 10. 28. 오후 3:00:00',
      '기기: iPhone · 화면 390×664 · 배율 3',
      '[이 탭을 연 때부터]',
      '첫 화면 표시: 1.84초',
      '시작 버튼 누를 수 있음: 6.21초',
      '시작 누름: 8.02초',
      '미술관 안 도착: 11.42초',
      '사진 고름: 24.10초',
      '첫 작품 걸림: 28.20초',
      '[구간]',
      '시작 → 첫 작품 걸림: 20.18초',
      '사진 고른 뒤 → 걸림: 4.10초',
      '[미술관 안 프레임 간격 10초]',
      '1회 도착 직후, 끝 10.01초: p50 16.7ms · p95 33.4ms · 최대 120.3ms · 598개',
      '[다시 열림]',
      '아니요 · 이 탭 열기 1번째 · 열린 방식 navigate · 크롬이 메모리 때문에 닫았던 탭 알 수 없음',
    ]);
  });

  it('없는 값은 없음, 재는 중이면 남은 초, 멈춘 재기는 까닭과 잰 시간', () => {
    const empty = report(state(), info);
    expect(empty).toContain('첫 화면 표시: 없음');
    expect(empty).toContain('시작 → 첫 작품 걸림: 없음');
    expect(empty[empty.indexOf('[미술관 안 프레임 간격 10초]') + 1]).toBe('없음');
    expect(report(state({ running: { from: 'button', left: 7 } }), info)).toContain('재는 중(직접 시작): 7초 남음');
    const stopped = state({ frames: [{ from: 'button', end: 'picker', ms: 4200, at: 1, stats: frameStats([]) }] });
    expect(report(stopped, info)).toContain(`1회 직접 시작, ${FRAME_END.picker} 4.20초: 값 없음`);
  });

  it('다시 열렸으면 예와 단서를 쓰고 앞선 열기의 기록을 끝에 붙인다. 저장용 글에는 붙이지 않는다', () => {
    const again = state({ reopen: { loads: 2, navType: 'reload', discarded: true, reopened: true }, previous: '첫 화면 표시: 1.84초\n시작 누름: 없음' });
    const lines = report(again, info);
    expect(lines).toContain('예 · 이 탭 열기 2번째 · 열린 방식 reload · 크롬이 메모리 때문에 닫았던 탭 예');
    expect(lines.slice(-3)).toEqual(['[이전 열기의 마지막 기록]', '첫 화면 표시: 1.84초', '시작 누름: 없음']);
    expect(report(again, info, false)).not.toContain('[이전 열기의 마지막 기록]');
  });
});

describe('측정 기록', () => {
  let frames: ReturnType<typeof manualFrames>, m: ReturnType<typeof createMeasure> | null = null;
  beforeEach(() => { sessionStorage.clear(); frames = manualFrames(); });
  afterEach(() => {
    m?.dispose(); m = null;
    vi.restoreAllMocks(); vi.unstubAllGlobals(); performance.clearMarks();
    Reflect.deleteProperty(document, 'visibilityState'); document.body.replaceChildren();
  });

  it('이벤트를 받은 시각을 적고, 같은 이름은 처음 값을 둔다. 모르는 이름은 버린다', () => {
    const now = vi.spyOn(performance, 'now');
    m = createMeasure();
    now.mockReturnValue(1500); send('title-shown');
    now.mockReturnValue(2500); send('title-shown'); send('no-such-mark');
    expect(m.state.marks).toEqual({ 'title-shown': 1500 });
  });

  it('도착하면 정한 시간 동안 프레임 간격을 재고, 끝나면 결과를 남기고 그만 돈다', () => {
    m = createMeasure();
    send('inside');
    expect(m.state.running).toEqual({ from: 'inside', left: MEASURE.windowMs / 1000 });
    frames.run(1000, 20, 3000);
    expect(m.state.running?.left).toBe(MEASURE.windowMs / 1000 - 2); // 남은 초는 1초마다 줄어든다
    frames.run(3020, 20, 1000 + MEASURE.windowMs);
    expect(m.state.running).toBeNull();
    expect(m.state.frames).toHaveLength(1);
    expect(m.state.frames[0]).toMatchObject({ from: 'inside', end: 'done', ms: MEASURE.windowMs, stats: { n: MEASURE.windowMs / 20, p50: 20, p95: 20, max: 20 } });
    expect(frames.pending()).toBe(0);
    send('inside'); // 두 번째 도착은 다시 재지 않는다
    expect(m.state.running).toBeNull();
  });

  it('사진 고르기 칸을 열면 재기를 멈추고, 고른 시각은 첫 작품이 걸리기 전까지 마지막 값을 둔다', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    m = createMeasure();
    send('inside');
    frames.run(0, 16, 160);
    const input = document.createElement('input');
    input.type = 'file';
    document.body.append(input);
    input.click();
    expect(m.state.frames[0]).toMatchObject({ from: 'inside', end: 'picker', ms: 160, stats: { n: 10 } });
    input.dispatchEvent(new Event('change', { bubbles: true })); // 고르지 않고 닫음
    expect(m.state.marks['photo-picked']).toBeUndefined();
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png')], configurable: true });
    now.mockReturnValue(5000); input.dispatchEvent(new Event('change', { bubbles: true }));
    now.mockReturnValue(6000); input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.state.marks['photo-picked']).toBe(6000);
    now.mockReturnValue(9000); send('first-saved');
    now.mockReturnValue(9500); input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(m.state.marks).toMatchObject({ 'photo-picked': 6000, 'first-saved': 9000 });
  });

  it('화면이 가려지면 멈춘다', () => {
    m = createMeasure();
    m.startFrames('button');
    frames.tick(0); frames.tick(16);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(m.state.frames[0]).toMatchObject({ from: 'button', end: 'hidden', stats: { n: 1, max: 16 } });
    expect(frames.pending()).toBe(0);
  });

  it('늦게 켜져도 WorldView가 performance.mark로 남긴 앞선 시각을 채운다', () => {
    performance.mark(MEASURE.markPrefix + 'title-shown');
    const t = performance.getEntriesByName(MEASURE.markPrefix + 'title-shown', 'mark')[0]!.startTime;
    m = createMeasure();
    expect(m.state.marks['title-shown']).toBe(t);
  });

  it('같은 탭에서 다시 열리면 횟수가 오르고, 앞선 열기에서 마지막으로 적은 값을 보인다', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234);
    const before = createMeasure();
    send('title-shown');
    before.dispose();
    m = createMeasure();
    expect(m.state.reopen).toMatchObject({ loads: 2, reopened: true });
    expect(m.state.previous).toContain('첫 화면 표시: 1.23초');
    expect(m.state.previous).not.toContain('[이전 열기의 마지막 기록]');
  });
});

describe('측정 표시 화면', () => {
  let w: VueWrapper | null = null, dispose: (() => void) | null = null;
  beforeEach(() => { sessionStorage.clear(); vi.resetModules(); manualFrames(); });
  afterEach(() => {
    w?.unmount(); w = null; dispose?.(); dispose = null;
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard'); Reflect.deleteProperty(document, 'execCommand');
  });
  async function open() {
    const [{ default: WorldMeasure }, measure] = await Promise.all([import('@/app/world/WorldMeasure.vue'), import('@/app/world/measure')]);
    w = mount(WorldMeasure, { global: { stubs: { teleport: true } } });
    const m = measure.useMeasure();
    dispose = m.dispose;
    return { view: w, m };
  }
  const clipboard = (writeText: (t: string) => Promise<void>) => Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

  it('접힌 단추에 가장 최근 값이 보이고, 펼치면 전체 값과 버튼 셋, [값 복사]는 같은 글을 복사한다', async () => {
    const writeText = vi.fn((_t: string) => Promise.resolve());
    clipboard(writeText);
    const { view } = await open();
    vi.spyOn(performance, 'now').mockReturnValue(1840);
    send('title-shown');
    await nextTick();
    expect(view.get('.m-pill').text()).toBe('측정 · 첫 화면 표시 1.84초');
    expect(view.find('.m-panel').exists()).toBe(false);
    await view.get('.m-pill').trigger('click');
    expect(view.get('.m-lines').text()).toContain('첫 화면 표시: 1.84초');
    expect(view.findAll('.m-actions button').map((b) => b.text())).toEqual(['값 복사', '프레임 재기', '접기']);
    await view.get('.m-actions button').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).toContain('첫 화면 표시: 1.84초');
    expect(view.get('.m-note').text()).toBe('복사했어요. 메모 앱에 붙여 넣어 주세요');
    await view.findAll('.m-actions button')[2]!.trigger('click');
    expect(view.find('.m-panel').exists()).toBe(false);
  });

  it('복사 권한이 막히면 글 상자를 보이고 전체를 골라 둔다', async () => {
    clipboard(() => Promise.reject(new Error('denied')));
    const { view } = await open();
    await view.get('.m-pill').trigger('click');
    await view.get('.m-actions button').trigger('click');
    await flushPromises();
    const area = view.get('textarea.m-copy').element as HTMLTextAreaElement;
    expect(area.value.startsWith('우리 아이 미술관 측정')).toBe(true);
    expect([area.selectionStart, area.selectionEnd]).toEqual([0, area.value.length]);
    expect(view.get('.m-note').text()).toContain('길게 눌러');
  });

  it('보안 연결이 아니라 clipboard가 없으면 누른 순간 옛 방식으로 복사한다', async () => {
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    const { view } = await open();
    await view.get('.m-pill').trigger('click');
    await view.get('.m-actions button').trigger('click');
    await flushPromises();
    expect(exec).toHaveBeenCalledWith('copy');
    expect(view.find('textarea.m-copy').exists()).toBe(false);
    expect(view.get('.m-note').text()).toBe('복사했어요. 메모 앱에 붙여 넣어 주세요');
  });

  it('[프레임 재기]는 걸을 수 있게 상자를 접고 직접 시작으로 잰다', async () => {
    const { view, m } = await open();
    await view.get('.m-pill').trigger('click');
    await view.findAll('.m-actions button')[1]!.trigger('click');
    expect(view.find('.m-panel').exists()).toBe(false);
    expect(view.get('.m-pill').text()).toBe(`측정 · 프레임 재는 중 ${MEASURE.windowMs / 1000}초`);
    expect(m.state.running?.from).toBe('button');
  });
});
