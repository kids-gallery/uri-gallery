// 1인칭 고전 회랑 배치(D33, SD_02 §17-9): 입구 쪽이 최근 나이, 구역 안은 최근 작품부터 좌우 번갈아, 깊이(96m)를 넘으면 걸지 않는다.
import { describe, expect, it } from 'vitest';
import { layout, ZMAX, ZMIN } from '../app/walkphoto/engine';

const art = (id: string, age: number, madeOn: string) => ({ id, title: id, age, madeOn, src: null });
describe('고전 회랑 배치', () => {
  it('최근 나이가 입구 쪽, 구역 안은 최근 작품부터 좌우 번갈아', () => {
    const { sections, hung } = layout([
      { age: 5, items: [art('a', 5, '2024-01-01'), art('b', 5, '2024-05-01')] },
      { age: 7, items: [art('c', 7, '2026-01-01')] },
    ]);
    expect(sections.map((s) => s.age)).toEqual([7, 5]);
    expect(sections[0]!.z0).toBeGreaterThan(ZMIN);
    expect(hung.map((h) => h.art.id)).toEqual(['c', 'b', 'a']);
    expect(hung.map((h) => h.side)).toEqual([-1, -1, 1]);
    expect(hung[1]!.z).toBeGreaterThan(hung[0]!.z);
  });
  it('깊이를 넘는 작품은 걸지 않는다(나머지는 목록)', () => {
    const many = Array.from({ length: 80 }, (_, i) => art(`x${i}`, 6, `2025-01-${String((i % 28) + 1).padStart(2, '0')}`));
    const { hung } = layout([{ age: 6, items: many }]);
    expect(hung.length).toBeLessThan(80);
    expect(Math.max(...hung.map((h) => h.z))).toBeLessThanOrEqual(ZMAX);
  });
});
