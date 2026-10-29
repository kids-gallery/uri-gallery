// 3D미술관_재설계 §2-2 대성당 실내: 평면 입력만으로 지어지고, 다시 지어도 기하가 쌓이지 않으며, 좌표가 유한하다.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Cathedral, NAVE_WALL } from '@/app/world/cathedral';

const plan = (rooms: number) => ({
  R: 12, Z0: -Math.sqrt(144 - 25), zEnd: -37, corW: 10, corH: 7, roomD: 10, roomL: 10, roomH: 6, doorW: 3.2, doorH: 4.2,
  rooms: Array.from({ length: rooms }, (_, i) => ({ side: (i % 2 ? 1 : -1) as -1 | 1, cz: -18 - Math.floor(i / 2) * 12 })),
});

function stats(root: THREE.Object3D) {
  let meshes = 0, finite = true, maxY = -Infinity;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes++;
    const box = new THREE.Box3().setFromObject(o);
    if (![box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite)) finite = false;
    maxY = Math.max(maxY, box.max.y);
  });
  return { meshes, finite, maxY, children: root.children.length };
}

describe('대성당 실내', () => {
  it('평면으로 짓고 모든 좌표가 유한하다', () => {
    const c = new Cathedral();
    c.build(plan(4));
    const s = stats(c.root);
    expect(s.meshes).toBeGreaterThan(50);
    expect(s.finite).toBe(true);
    expect(s.maxY).toBeGreaterThan(NAVE_WALL + 10); // 돔이 신랑 천장보다 훨씬 높다
  });

  it('다시 지으면 이전 부재를 비우고 같은 수로 짓는다', () => {
    const c = new Cathedral();
    c.build(plan(4));
    const first = stats(c.root).children;
    c.build(plan(4));
    expect(stats(c.root).children).toBe(first);
  });

  it('전시실이 늘면 예배당 부재도 는다', () => {
    const c = new Cathedral();
    c.build(plan(2));
    const two = stats(c.root).meshes;
    c.build(plan(6));
    expect(stats(c.root).meshes).toBeGreaterThan(two);
  });

  it('작품과 조작 판정에 쓰는 표시를 단다', () => {
    const c = new Cathedral();
    c.build(plan(2));
    let marked = true;
    c.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.cathedral) marked = false; });
    expect(marked).toBe(true);
  });
});
