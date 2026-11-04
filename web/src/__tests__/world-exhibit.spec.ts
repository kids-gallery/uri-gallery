// 전시용 판(마스터플랜 3-3): 작품만 남기고 색만 맞춘다
import { describe, expect, it } from 'vitest';
import { exhibitPixels } from '@/app/world/exhibit';

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
