// D46 ④⑧ 가족 댓글(SD_02 §17-14): 걸린 뒤 7일 — 남은 날 · 지나면 보기만 · 409 comments_closed · 불러오기 실패는 "기간 끝"과 다르게.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentPanel from '../components/CommentPanel.vue';
import { ko } from '../copy/ko';

const json = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const closed409 = () => json({ type: 'about:blank', title: 'conflict', status: 409, code: 'conflict', reason: 'comments_closed' }, 409);
const c1 = { id: '1', body: '멋지다', createdAt: '2026-09-30T01:00:00.000Z', mine: true, author: 'me' };
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('가족 댓글 7일(D46)', () => {
  it('기한 안: 남은 날(올림)과 입력 · 내 댓글 [지우기]', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-30T00:00:00Z'));
    fetchMock.mockImplementation(async () => json({ items: [c1], open: true, openUntil: '2026-10-02T12:00:00.000Z', days: 7 }));
    const w = mount(CommentPanel, { props: { artworkId: '7' } });
    await flushPromises();
    expect(w.text()).toContain(ko.comment.left(3));
    expect(w.find('textarea').exists()).toBe(true);
    expect(w.findAll('button').some((b) => b.text() === ko.comment.del)).toBe(true);
    w.unmount();
  });
  it('기한 지남: 보기만(입력 · 지우기 없음)', async () => {
    fetchMock.mockImplementation(async () => json({ items: [c1], open: false, openUntil: '2026-09-01T00:00:00.000Z', days: 7 }));
    const w = mount(CommentPanel, { props: { artworkId: '7' } });
    await flushPromises();
    expect(w.text()).toContain('멋지다');
    expect(w.text()).toContain(ko.comment.closed);
    expect(w.find('textarea').exists()).toBe(false);
    expect(w.findAll('button').some((b) => b.text() === ko.comment.del)).toBe(false);
    w.unmount();
  });
  it('지우는 사이 기한이 끝나면(409) 보기만으로 바꾼다', async () => {
    fetchMock.mockImplementation(async (_u: string, i?: RequestInit) => (i?.method === 'DELETE' ? closed409()
      : json({ items: [c1], open: true, openUntil: '2099-01-01T00:00:00.000Z', days: 7 })));
    const w = mount(CommentPanel, { props: { artworkId: '7' } });
    await flushPromises();
    await w.findAll('button').find((b) => b.text() === ko.comment.del)!.trigger('click');
    await flushPromises();
    expect(w.text()).toContain(ko.comment.closed);
    expect(w.find('textarea').exists()).toBe(false);
    expect(w.text()).toContain('멋지다');
    w.unmount();
  });
  it('불러오기 실패는 "기간이 끝났어요"가 아니라 [다시 불러오기]', async () => {
    fetchMock.mockImplementation(async () => { throw new TypeError('network'); });
    const w = mount(CommentPanel, { props: { artworkId: '7' } });
    await flushPromises();
    expect(w.text()).toContain(ko.comment.loadFail);
    expect(w.text()).not.toContain(ko.comment.closed);
    expect(w.findAll('button').some((b) => b.text() === ko.comment.retry)).toBe(true);
    w.unmount();
  });
});
