// 전시용 판(마스터플랜 3-3): 작품만 남기고 색만 맞춘다
import { describe, expect, it } from 'vitest';
import { exhibitPixels, fillPaperHoles } from '@/app/world/exhibit';

const px = (...p: number[][]) => new Uint8ClampedArray(p.flat());

describe('전시용 판', () => {
  it('투명한 곳은 원래 색을 버리고 종이색으로 채운다', () => {
    const out = exhibitPixels(px([200, 10, 10, 255], [0, 200, 0, 0]));
    expect([out[4], out[5], out[6], out[7]]).toEqual([248, 244, 234, 255]);
    expect(out[3]).toBe(255);
  });
  it('색 틀어진 사진의 밝은 쪽을 흰색에 가깝게 맞춘다', () => {
    const paper = Array.from({ length: 20 }, () => [210, 200, 190, 255]);
    const out = exhibitPixels(px(...paper));
    expect(out[0]).toBe(245);
    expect(out[1]).toBe(245);
    expect(out[2]).toBe(245);
  });
  it('어두운 작품은 억지로 밝히지 않는다', () => {
    const out = exhibitPixels(px([40, 40, 40, 255]));
    expect(out[0]).toBe(54); // 상한 1.35배
  });
  it('이미 밝으면 어둡게 하지 않고, 입력을 바꾸지 않는다', () => {
    const input = px([250, 250, 250, 255]);
    const out = exhibitPixels(input);
    expect(out[0]).toBe(250);
    expect(input[0]).toBe(250);
  });
  it('부드러운 경계는 종이색과 섞는다', () => {
    const out = exhibitPixels(px([0, 0, 0, 128], [245, 245, 245, 255]));
    expect(out[0]).toBeGreaterThan(100);
    expect(out[0]).toBeLessThan(140);
  });
  it('작품 화소가 없어도 멈추지 않는다', () => {
    expect(exhibitPixels(px([9, 9, 9, 0]))[0]).toBe(248);
  });
});

/** 파란 도화지(20×20)에 빨간 작품(8~11행·열). skip이 참인 자리는 투명 */
function sheet(skip: (x: number, y: number) => boolean, w = 20, h = 20) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (skip(x, y)) continue;
    const art = x >= 8 && x < 12 && y >= 8 && y < 12;
    out.set(art ? [200, 0, 0, 255] : [40, 60, 180, 255], (y * w + x) * 4);
  }
  return out;
}
const at = (d: Uint8ClampedArray, x: number, y: number, w = 20) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];

describe('손 자리 메꾸기', () => {
  const bite = (x: number, y: number) => x < 3 && y >= 6 && y < 14; // 왼쪽 가장자리가 손 모양으로 파였다
  it('파인 자리를 둘레 도화지 색으로 메꾸고 불투명하게 한다', () => {
    const input = sheet(bite);
    const out = fillPaperHoles(input, 20, 20);
    expect(at(out, 1, 10)).toEqual([40, 60, 180, 255]);
    expect(at(input, 1, 10)[3]).toBe(0); // 입력은 그대로
  });
  it('작품 화소는 바꾸지 않는다', () => {
    const out = fillPaperHoles(sheet(bite), 20, 20);
    expect(at(out, 9, 9)).toEqual([200, 0, 0, 255]);
    expect(at(out, 15, 15)).toEqual([40, 60, 180, 255]);
  });
  it('안쪽 구멍도 메꾼다', () => {
    const out = fillPaperHoles(sheet((x, y) => x >= 15 && x < 17 && y >= 3 && y < 5), 20, 20);
    expect(at(out, 15, 3)).toEqual([40, 60, 180, 255]);
  });
  it('구멍 둘레에 남은 손 색을 번지게 하지 않는다', () => {
    const input = sheet(bite);
    for (let y = 6; y < 14; y++) input.set([230, 110, 90, 255], (y * 20 + 3) * 4); // 손 가장자리가 한 줄 남았다
    const out = fillPaperHoles(input, 20, 20);
    expect(at(out, 1, 10)).toEqual([40, 60, 180, 255]);
    expect(at(out, 3, 10)).toEqual([40, 60, 180, 255]);
  });
  it('구멍에 붙은 넓은 손 그림자도 함께 메꾸고, 떨어진 작품은 그대로 둔다', () => {
    const input = sheet((x, y) => x < 3 && y >= 18 && y < 26, 30, 30);
    for (let y = 18; y < 26; y++) for (let x = 3; x < 12; x++) input.set([20, 15, 20, 255], (y * 30 + x) * 4);
    const out = fillPaperHoles(input, 30, 30);
    expect(at(out, 10, 22, 30)).toEqual([40, 60, 180, 255]);
    expect(at(out, 9, 9, 30)).toEqual([200, 0, 0, 255]);
  });
  it('볼록 껍질 바깥과 떨어진 티끌은 도화지를 늘리지 않는다', () => {
    const input = new Uint8ClampedArray(40 * 40 * 4);
    for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) if (!(x < 8 && y >= 12 && y < 18)) input.set([40, 60, 180, 255], (y * 40 + x) * 4);
    input.set([9, 9, 9, 255], (38 * 40 + 38) * 4);
    const out = fillPaperHoles(input, 40, 40);
    expect(at(out, 6, 14, 40)[3]).toBe(255);
    expect(at(out, 30, 30, 40)[3]).toBe(0);
    expect(at(out, 2, 14, 40)[3]).toBe(0);
  });
  it('메꿀 곳이 없으면 입력을 그대로 돌려준다', () => {
    const input = sheet(() => false);
    expect(fillPaperHoles(input, 20, 20)).toBe(input);
  });
  it('그림만 따낸 모양은 도화지가 아니므로 그대로 둔다', () => {
    const input = sheet((x, y) => !(y === 10 || x === 10)); // 십자 모양, 볼록 껍질의 60%에 못 미친다
    expect(fillPaperHoles(input, 20, 20)).toBe(input);
  });
  it('작품이 없어도 멈추지 않는다', () => {
    const input = new Uint8ClampedArray(16);
    expect(fillPaperHoles(input, 2, 2)).toBe(input);
  });
});
