// D49 움직임 질문(SD_02 §17-9): 판정이 움직임을 제안한 그림만 "애니메이션으로 만드시겠습니까?" [예] · [아니오].
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnimateAsk from '../components/AnimateAsk.vue';
import { ko } from '../copy/ko';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
const base = { suggestion: 'animated', confirmedKind: null, choices: ['animated', 'relief', 'frame'], making: false };
function serve(d: object) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST' && String(url).endsWith('/confirm')) return json({ ...d, confirmedKind: 'animated' });
    return json(d);
  });
}
const posts = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/confirm') && i?.method === 'POST');
const btn = (w: ReturnType<typeof mount>, t: string) => w.findAll('button').find((b) => b.text() === t);

beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('움직임 질문(D49)', () => {
  it('움직임 제안 그림이면 묻고, [예]는 animated로 확정한다', async () => {
    serve(base);
    const w = mount(AnimateAsk, { props: { artworkId: '7' } });
    await flushPromises();
    expect(w.text()).toContain(ko.animAsk.q);
    expect(btn(w, ko.animAsk.yes)).toBeTruthy();
    expect(btn(w, ko.animAsk.no)).toBeTruthy();
    await btn(w, ko.animAsk.yes)!.trigger('click');
    await flushPromises();
    expect(JSON.parse(String(posts()[0]![1]!.body))).toEqual({ kind: 'animated' });
    expect(w.text()).toContain(ko.animAsk.started);
    expect(w.emitted('started')).toBeTruthy();
    w.unmount();
  });
  it('[아니오]면 확정하지 않고, 이 기기에서 다시 묻지 않는다', async () => {
    serve(base);
    const w = mount(AnimateAsk, { props: { artworkId: '8' } });
    await flushPromises();
    await btn(w, ko.animAsk.no)!.trigger('click');
    expect(posts()).toHaveLength(0);
    expect(w.text()).not.toContain(ko.animAsk.q);
    w.unmount();
    const again = mount(AnimateAsk, { props: { artworkId: '8' } });
    await flushPromises();
    expect(again.text()).not.toContain(ko.animAsk.q);
    again.unmount();
  });
  it.each([
    ['만들기 작품', { making: true }],
    ['이미 확정', { confirmedKind: 'frame' }],
    ['움직임 선택지 막힘(M3 꺼짐)', { choices: ['frame'] }],
    ['판정이 다른 제안', { suggestion: 'relief' }],
  ])('%s이면 묻지 않는다', async (_n, over) => {
    serve({ ...base, ...over });
    const w = mount(AnimateAsk, { props: { artworkId: '9' } });
    await flushPromises();
    expect(w.text()).not.toContain(ko.animAsk.q);
    expect(w.emitted('close')).toBeTruthy();
    w.unmount();
  });
  it('판정 전이면 기다렸다가 제안이 오면 묻는다', async () => {
    vi.useFakeTimers();
    let n = 0;
    fetchMock.mockImplementation(async () => json(++n < 2 ? { ...base, suggestion: null } : base));
    const w = mount(AnimateAsk, { props: { artworkId: '10' } });
    await flushPromises();
    expect(w.text()).toContain(ko.animAsk.judging);
    await vi.advanceTimersByTimeAsync(3100);
    await flushPromises();
    expect(w.text()).toContain(ko.animAsk.q);
    w.unmount();
  });
});
