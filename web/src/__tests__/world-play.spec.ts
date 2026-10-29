// 3D미술관_재설계 §2-11 작품 퍼즐: 같은 모양 조각은 서로 바꿔도 맞은 자리, 이미 맞은 배치로 섞지 않기, 모두 같은 그림은 null.
import { describe, expect, it } from 'vitest';
import { isSolved, sameTable, shuffleTiles, tileSignatures } from '@/app/world/play';

/** w×h RGBA. paint(x,y)가 색을 주면 칠하고, 없으면 종이색. */
function picture(w: number, h: number, paint: (x: number, y: number) => [number, number, number] | null) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = paint(x, y) ?? [255, 253, 245], i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return d;
}

describe('작품 퍼즐 판정', () => {
  // 120×90 그림, 3×3 조각. 왼쪽 위 조각(0)과 가운데 조각(4)에만 선이 있다.
  const data = picture(120, 90, (x, y) => (x < 40 && y < 30 && y > 10 && y < 16) || (x >= 40 && x < 80 && y >= 30 && y < 60 && x === y + 20) ? [60, 128, 209] : null);
  const same = sameTable(tileSignatures(data, 120, 90, 3), 9);

  it('빈 조각끼리는 같은 모양, 그림 조각은 다른 모양', () => {
    expect(same[1]![2]).toBe(true);
    expect(same[0]![1]).toBe(false);
    expect(same[4]![8]).toBe(false);
  });

  it('그림 조각만 제자리면 빈 조각 순서가 달라도 완성', () => {
    expect(isSolved([0, 2, 1, 5, 4, 3, 8, 7, 6], same)).toBe(true);
  });

  it('그림 조각이 다른 자리에 있으면 미완성', () => {
    expect(isSolved([4, 1, 2, 3, 0, 5, 6, 7, 8], same)).toBe(false);
  });

  it('섞은 배치는 완성으로 보이지 않는다', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 20; i++) {
      const order = shuffleTiles(9, same, random)!;
      expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(isSolved(order, same)).toBe(false);
    }
  });

  it('모든 조각이 같으면 섞지 못하고 null', () => {
    const blank = sameTable(tileSignatures(picture(60, 60, () => null), 60, 60, 2), 4);
    expect(shuffleTiles(4, blank)).toBeNull();
  });

  it('그림을 읽지 못하면 조각 번호로만 판정한다', () => {
    const plain = sameTable(null, 4);
    expect(isSolved([1, 0, 2, 3], plain)).toBe(false);
    expect(isSolved([0, 1, 2, 3], plain)).toBe(true);
  });

  it('투명한 부분은 흰 바탕으로 본다', () => {
    const d = new Uint8ClampedArray(20 * 20 * 4); // 모두 투명
    const sig = tileSignatures(d, 20, 20, 1)[0]!;
    expect(sig.every((v) => v === 255)).toBe(true);
  });
});
