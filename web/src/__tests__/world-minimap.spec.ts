// 미니맵(마스터플랜 3-3 #137): 평면 범위와 좌표 옮기기
import { describe, expect, it } from 'vitest';
import { mapBounds, mapProject } from '@/app/world/minimap';
import { createLayout } from '@/app/world/spatialLayout';

describe('미니맵', () => {
  it('돌아간 길도 범위에 넣는다', () => {
    const b = mapBounds([{ x: 0, z: 0, w: 2, d: 10, yaw: Math.PI / 2 }]);
    expect(b.maxX).toBeCloseTo(5);
    expect(b.maxZ).toBeCloseTo(1);
  });
  it('네 모드 모두 평면과 방이 칸 안에 들어온다', () => {
    for (const mode of ['classic', 'block', 'forest', 'toy'] as const) {
      const l = createLayout(mode, 6, mode === 'classic');
      const p = mapProject(mapBounds(l.floors), 92);
      for (const r of l.rooms) {
        for (const v of [p.x(r.x), p.y(r.z)]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(92); }
      }
    }
  });
  it('안쪽(-z)이 위로 간다', () => {
    const p = mapProject({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, 100);
    expect(p.y(-10)).toBeLessThan(p.y(10));
    expect(p.x(-10)).toBeLessThan(p.x(10));
  });
});
