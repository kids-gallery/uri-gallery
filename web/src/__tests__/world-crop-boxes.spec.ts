// #118 자르기 창: 아이가 같이 찍혔는지 답하기 전에는 쓸 수 없고, 답에 따라 처음 네 모서리가 달라진다.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PhotoFixer from '@/app/upload/PhotoFixer.vue';
import { CROP_BOXES, WORK_KINDS } from '@/app/world/cropBoxes';

vi.mock('@/app/upload/autocrop', () => ({ warpQuad: () => { const c = document.createElement('canvas'); c.width = 10; c.height = 10; return c; } }));

const W = 1000, H = 2000;
const canvasCtx = { drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {} };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob(['x']) })));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: W, height: H })));
  vi.stubGlobal('Image', class { src = ''; naturalWidth = W; naturalHeight = H; decode = async () => undefined; });
  HTMLCanvasElement.prototype.getContext = (() => canvasCtx) as never;
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,';
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { cb(new Blob(['j'], { type: 'image/jpeg' })); };
});
afterEach(() => { vi.unstubAllGlobals(); });

async function open() {
  const w = mount(PhotoFixer, { props: { src: 'blob:1', boxOptions: CROP_BOXES, boxAsk: '사진에 아이가 같이 찍혔나요?', kindOptions: WORK_KINDS, kindAsk: '어떤 작품인가요?' }, global: { stubs: { Teleport: true } } });
  await flushPromises(); await flushPromises();
  return w;
}
const button = (w: Awaited<ReturnType<typeof open>>, name: string) => w.findAll('button').find((b) => b.text() === name)!;
const topY = (w: Awaited<ReturnType<typeof open>>) => Number(w.find('polygon').attributes('points')!.split(' ')[0]!.split(',')[1]);

describe('자르기 창의 질문', () => {
  it('답하기 전에는 이대로 쓰기를 누를 수 없고, 답하면 보낼 수 있다', async () => {
    const w = await open();
    expect(button(w, '이대로 쓰기').attributes('disabled')).toBeDefined();
    await button(w, '작품만 찍었어요').trigger('click');
    expect(button(w, '이대로 쓰기').attributes('disabled')).toBeDefined(); // 종류도 답해야 한다
    await button(w, '만들기예요').trigger('click');
    expect(button(w, '이대로 쓰기').attributes('disabled')).toBeUndefined();
    await button(w, '이대로 쓰기').trigger('click');
    await flushPromises();
    expect(w.emitted('done')![0]![3]).toBe('making');
  });

  it('작품만 찍었으면 세로 그림의 윗부분을 자르지 않는다', async () => {
    const w = await open();
    await button(w, '작품만 찍었어요').trigger('click');
    expect(topY(w)).toBeCloseTo(H * 0.04);
  });

  it('같이 찍혔으면 얼굴이 있을 위쪽을 빼고 시작한다', async () => {
    const w = await open();
    await button(w, '아이가 같이 찍혔어요').trigger('click');
    expect(topY(w)).toBeCloseTo(H * 0.38);
    expect(button(w, '아이가 같이 찍혔어요').attributes('aria-pressed')).toBe('true');
  });

  it('가로 사진도 같이 찍혔으면 위쪽을 뺀다', () => {
    expect(CROP_BOXES[0]!.box(2000, 1000)[0]![1]).toBeCloseTo(380);
  });

  it('질문을 주지 않는 화면은 지금처럼 바로 쓸 수 있다', async () => {
    const w = mount(PhotoFixer, { props: { src: 'blob:1' }, global: { stubs: { Teleport: true } } });
    await flushPromises(); await flushPromises();
    expect(button(w, '이대로 쓰기').attributes('disabled')).toBeUndefined();
  });
});
