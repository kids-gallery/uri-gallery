// 3D미술관_재설계 §2-15 꾸미기 규칙: 자리 계산(작품을 바라보는 사람 기준 좌우), 막힌 이유, 저장 형식 검사.
import { describe, expect, it } from 'vitest';
import { decorBlocked, decorPose, isDecorItem, overlaps, type DecorContext } from '@/app/world/decor';

const open: DecorContext = { onFloor: () => true, hitsSolid: () => false, stands: [], doors: [], others: [] };

describe('꾸미기 자리', () => {
  it('+z를 보는 벽 작품: 바라보는 사람의 오른쪽은 +x, 소품은 벽에서 0.55m 앞', () => {
    const r = decorPose('plant', 'wall', { x: 0, z: 0 }, { x: 0, z: 1 }, 'right');
    const l = decorPose('plant', 'wall', { x: 0, z: 0 }, { x: 0, z: 1 }, 'left');
    expect(r.x).toBeCloseTo(1.15); expect(r.z).toBeCloseTo(0.55);
    expect(l.x).toBeCloseTo(-1.15);
  });
  it('-x를 보는 벽 작품: 오른쪽은 +z', () => {
    const r = decorPose('lamp', 'wall', { x: 10, z: 0 }, { x: -1, z: 0 }, 'right');
    expect(r.z).toBeCloseTo(1.15); expect(r.x).toBeCloseTo(9.45);
  });
  it('벤치는 작품 정면 3.4m, 벽과 나란히 길다', () => {
    const b = decorPose('bench', 'wall', { x: 0, z: 0 }, { x: 0, z: 1 }, 'front');
    expect(b.z).toBeCloseTo(3.4); expect(b.box.maxX - b.box.minX).toBeCloseTo(1.6);
  });
  it('받침대 작품은 좌우 0.95m, 벽 거리 없음', () => {
    const r = decorPose('plant', 'pedestal', { x: 2, z: 3 }, { x: 0, z: 1 }, 'right');
    expect(r.x).toBeCloseTo(2.95); expect(r.z).toBeCloseTo(3);
  });
});

describe('놓을 수 없는 이유', () => {
  const p = decorPose('plant', 'wall', { x: 0, z: 0 }, { x: 0, z: 1 }, 'right');
  it('막힌 곳이 없으면 null', () => expect(decorBlocked(p, open)).toBeNull());
  it('바닥 밖', () => expect(decorBlocked(p, { ...open, onFloor: (x) => x < 1 })).toBe('바닥이 아닌 곳이에요'));
  it('벽·받침대', () => expect(decorBlocked(p, { ...open, hitsSolid: () => true })).toBe('벽이나 받침대와 겹쳐요'));
  it('다른 소품', () => expect(decorBlocked(p, { ...open, others: [p.box] })).toBe('다른 소품과 겹쳐요'));
  it('작품 앞에 서는 자리', () => expect(decorBlocked(p, { ...open, stands: [{ x: 1.15, z: 1.2 }] })).toBe('작품 앞에 서는 자리를 막아요'));
  it('문 앞 통로', () => expect(decorBlocked(p, { ...open, doors: [{ minX: 0.9, maxX: 1.4, minZ: 0, maxZ: 1 }] })).toBe('문으로 드나드는 길을 막아요'));
  it('떨어진 상자는 겹치지 않는다', () => expect(overlaps({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }, { minX: 2, maxX: 3, minZ: 0, maxZ: 1 })).toBe(false));
});

describe('저장 형식', () => {
  it('종류와 자리가 맞지 않는 항목은 버린다', () => {
    expect(isDecorItem({ id: 'a', kind: 'plant', work: 'w', spot: 'left' })).toBe(true);
    expect(isDecorItem({ id: 'a', kind: 'bench', work: 'w', spot: 'left' })).toBe(false);
    expect(isDecorItem({ id: 'a', kind: 'sofa', work: 'w', spot: 'left' })).toBe(false);
    expect(isDecorItem(null)).toBe(false);
  });
});
