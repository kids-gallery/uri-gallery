// 마스터플랜 3-6 시험: 서버 깊이가 있으면 둥근 입체, 없으면 지금 두께판. 삼각형 수와 값의 범위를 본다.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildRelief, RELIEF_SURFACE, surfaceGeometry, type Mask, type Surface } from '@/app/world/cutout';

function disc(side: number): Mask {
  const data = new Uint8Array(side * side);
  let n = 0;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) if (Math.hypot(x - side / 2, y - side / 2) < side * 0.4) { data[y * side + x] = 1; n++; }
  return { w: side, h: side, data, ok: true, ratio: n / (side * side) };
}
const surface = (side: number, value: (x: number, y: number) => number): Surface => {
  const data = new Float32Array(side * side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) data[y * side + x] = value(x, y);
  return { w: side, h: side, data };
};
const zOf = (geo: THREE.BufferGeometry) => Array.from({ length: geo.attributes.position!.count }, (_, i) => geo.attributes.position!.getZ(i));

describe('둥근 입체', () => {
  it('깊이가 없으면 지금처럼 두께판이다', () => {
    const m = buildRelief(new THREE.Texture(), disc(64), 1, { height: 1 });
    expect((m.material as THREE.MeshStandardMaterial).alphaMap).toBeNull();
    expect(m.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
  });

  it('깊이가 있으면 윤곽을 마스크로 자르는 입체가 된다', () => {
    const mask = disc(64);
    mask.surface = surface(64, () => 1);
    const m = buildRelief(new THREE.Texture(), mask, 1, { height: 1 });
    const mat = m.material as THREE.MeshStandardMaterial;
    expect(mat.alphaMap).not.toBeNull();
    expect(mat.alphaTest).toBe(0.5);
    expect(m.geometry).not.toBeInstanceOf(THREE.ExtrudeGeometry);
    expect(m.userData.size.d).toBeGreaterThan(0.1);
  });

  it('가운데가 가장자리보다 두껍고 값이 모두 유한하다', () => {
    const { geo, depth } = surfaceGeometry(disc(64), surface(64, () => 0.5), 1, 1);
    const z = zOf(geo);
    expect(z.every(Number.isFinite)).toBe(true);
    expect(Math.max(...z) - Math.min(...z)).toBeCloseTo(depth, 3);
    const pos = geo.attributes.position!, n = pos.count / 2;
    const near = (i: number) => Math.hypot(pos.getX(i), pos.getY(i));
    let centre = -Infinity, edge = -Infinity;
    for (let i = 0; i < n; i++) { if (near(i) < 0.05) centre = Math.max(centre, pos.getZ(i)); if (near(i) > 0.44) edge = Math.max(edge, pos.getZ(i)); }
    expect(centre).toBeGreaterThan(edge);
  });

  it('더 가까운 깊이가 더 높게 나온다', () => {
    const top = (v: number) => surfaceGeometry(disc(64), surface(64, () => v), 1, 1).depth;
    expect(top(1)).toBeGreaterThan(top(0));
  });

  it('삼각형 수가 격자 크기로 묶인다', () => {
    const G = RELIEF_SURFACE.grid, { geo } = surfaceGeometry(disc(G), surface(G, () => 0.5), 1, 1);
    expect(geo.index!.count / 3).toBeLessThanOrEqual(4 * G * G);
  });
});
