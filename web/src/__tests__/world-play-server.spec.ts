// #124 서버 판의 함께 그리기: 그림을 서버로 보내고, 실패하면 초안을 남겨 같은 요청 번호로 다시 보낸다.
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorldPlay from '@/app/world/WorldPlay.vue';

const up = vi.hoisted(() => ({ sendPhoto: vi.fn(), keys: 0 }));
vi.mock('@/app/world/server/upload', () => ({ SERVER_WORLD: true, newUploadKey: () => `key-${++up.keys}`, sendPhoto: up.sendPhoto }));
const db = vi.hoisted(() => ({ saveArtworkAndRoom: vi.fn(), deleteDraft: vi.fn(async () => undefined) }));
vi.mock('@/app/world/store', async (real) => ({
  ...(await real<typeof import('@/app/world/store')>()),
  getDraft: vi.fn(async () => null), saveDraft: vi.fn(async () => undefined),
  deleteDraft: db.deleteDraft, saveArtworkAndRoom: db.saveArtworkAndRoom,
}));

const ctx = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {} };
beforeEach(() => {
  vi.clearAllMocks();
  up.keys = 0;
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob(['png'], { type: 'image/png' })); };
  HTMLCanvasElement.prototype.setPointerCapture = () => undefined;
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 480 }) as DOMRect;
});

type Play = ReturnType<typeof mount>;
async function stroke(w: Play) {
  const c = w.find('canvas');
  c.element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 }));
  c.element.dispatchEvent(new MouseEvent('pointerup'));
  await flushPromises();
}
async function drawn() {
  const w = mount(WorldPlay, { props: { artworks: [], childAge: 0 } });
  await flushPromises();
  await w.findAll('button').find((b) => b.text().includes('함께 그리기'))!.trigger('click');
  await flushPromises();
  await stroke(w);
  return w;
}
const save = (w: Awaited<ReturnType<typeof drawn>>) => w.findAll('button').find((b) => b.text() === '우리 그림 보관하기')!;

describe('서버 판 함께 그리기', () => {
  it('서버로 보내고 받은 작품 번호를 알리며, 기기에 작품을 만들지 않는다', async () => {
    up.sendPhoto.mockResolvedValue({ ok: true, id: 'art-1', hung: true });
    const w = await drawn();
    await save(w).trigger('click');
    await flushPromises();
    const [file, key] = up.sendPhoto.mock.calls[0]!;
    expect((file as File).type).toBe('image/png');
    expect(key).toBe('key-1');
    expect(w.emitted('saved')).toEqual([['art-1']]);
    expect(db.saveArtworkAndRoom).not.toHaveBeenCalled();
    expect(db.deleteDraft).toHaveBeenCalled();
  });

  it('실패하면 이유를 보이고 초안을 지우지 않으며, 다시 누르면 같은 요청 번호로 보낸다', async () => {
    up.sendPhoto.mockResolvedValueOnce({ ok: false, reason: '미술관에 연결되지 않아요', retryable: true });
    const w = await drawn();
    db.deleteDraft.mockClear();
    await save(w).trigger('click');
    await flushPromises();
    expect(w.text()).toContain('미술관에 연결되지 않아요');
    expect(w.emitted('saved')).toBeUndefined();
    expect(db.deleteDraft).not.toHaveBeenCalled();
    up.sendPhoto.mockResolvedValueOnce({ ok: true, id: 'art-1', hung: true });
    await save(w).trigger('click');
    await flushPromises();
    expect(up.sendPhoto.mock.calls.map((c) => c[1])).toEqual(['key-1', 'key-1']);
    expect(w.emitted('saved')).toEqual([['art-1']]);
  });

  it('실패 뒤 그림을 고치면 앞선 그림이 돌아오지 않게 새 요청 번호로 보낸다', async () => {
    up.sendPhoto.mockResolvedValue({ ok: false, reason: '미술관에 연결되지 않아요', retryable: true });
    const w = await drawn();
    await save(w).trigger('click');
    await flushPromises();
    await stroke(w); // 한 획 더
    await save(w).trigger('click');
    await flushPromises();
    await w.findAll('button').find((b) => b.text() === '한 번 되돌리기')!.trigger('click'); // 한 획 되돌림
    await flushPromises();
    await save(w).trigger('click');
    await flushPromises();
    await save(w).trigger('click'); // 그대로 다시
    await flushPromises();
    expect(up.sendPhoto.mock.calls.map((c) => c[1])).toEqual(['key-1', 'key-2', 'key-3', 'key-3']);
  });
});
