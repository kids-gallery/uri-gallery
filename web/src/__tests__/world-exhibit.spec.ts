import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Performance, type Stage } from '../app/world/behaviors';

// §2-14: 벽 작품의 입체는 평소 숨어 있고 원본 액자가 보인다. 움직임이 끝나면 원래 보임 상태로 돌아가야 한다
const stage: Stage = { cx: 10, cz: 0, halfX: 4.2, halfZ: 4.2, ceiling: 6 };
function relief(visible: boolean) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), new THREE.MeshBasicMaterial());
  m.userData.size = { w: 1, h: 1, d: 0.05 };
  m.visible = visible;
  return m;
}

describe('exhibit relief visibility', () => {
  it('keeps a hidden wall relief hidden after the performance ends', () => {
    const parent = new THREE.Group(), source = relief(false);
    parent.add(source);
    const p = new Performance(source, new THREE.Vector3(0, 0, 1), 'spin', 'house', stage, parent);
    expect(p.actor.visible).toBe(true);
    expect(parent.children).toContain(p.actor);
    p.finish();
    expect(source.visible).toBe(false);
    expect(parent.children).not.toContain(p.actor);
  });

  it('restores a visible pedestal relief after the performance ends', () => {
    const parent = new THREE.Group(), source = relief(true);
    parent.add(source);
    const p = new Performance(source, new THREE.Vector3(0, 0, 1), 'spin', 'house', stage, parent);
    expect(source.visible).toBe(false);
    p.finish();
    expect(source.visible).toBe(true);
  });
});
