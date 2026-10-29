// 회색 모형 도구(3D미술관_재설계 §2-16). 질감·발광·장식 없이 덩어리 종류마다 회색 명도만 다르게 한다.
// 모든 치수는 미터이고, y는 물체의 바닥 높이다(함수마다 주석에 적는다).
import * as THREE from 'three';

export type Cat = 'ground' | 'path' | 'building' | 'roof' | 'tree' | 'trunk' | 'art' | 'frame' | 'water' | 'bench' | 'avatar';
export const GRAY: Record<Cat, string> = {
  ground: '#a7a39a', path: '#cfcac0', building: '#e8e5df', roof: '#c3beb5', tree: '#8a8f87', trunk: '#76716a',
  art: '#fbfbf9', frame: '#4d4a45', water: '#97a0a3', bench: '#9e988e', avatar: '#5f6c7b',
};
/** 화면 비중을 셀 때 쓰는 구분 색(겹치지 않는 원색) */
export const ID_COLOR: Record<Cat | 'sky', string> = {
  sky: '#000000', ground: '#ff0000', path: '#00ff00', building: '#0000ff', roof: '#ffff00', tree: '#00ffff', trunk: '#ff00ff',
  art: '#ffffff', frame: '#808080', water: '#ff8000', bench: '#8000ff', avatar: '#00ff80',
};
const mats = new Map<Cat, THREE.MeshStandardMaterial>();
export function clay(cat: Cat): THREE.MeshStandardMaterial {
  let m = mats.get(cat);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: GRAY[cat], roughness: 1, metalness: 0, side: cat === 'ground' || cat === 'water' ? THREE.DoubleSide : THREE.FrontSide }); mats.set(cat, m); }
  return m;
}

/** 0~1의 결정적 난수(같은 씨앗이면 같은 배치) */
export function seeded(seed: number) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export class Kit {
  readonly root = new THREE.Group();
  featured: THREE.Object3D | null = null;

  add(geo: THREE.BufferGeometry, cat: Cat, x: number, y: number, z: number, ry = 0) {
    const m = new THREE.Mesh(geo, clay(cat));
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cat !== 'ground' && cat !== 'water'; m.receiveShadow = true; m.userData.cat = cat;
    this.root.add(m); return m;
  }
  /** 바닥 y에 놓인 상자 */
  box(cat: Cat, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), cat, x, y + h / 2, z, ry); }
  /** 바닥 y에 놓인 원기둥 */
  cyl(cat: Cat, x: number, y: number, z: number, rTop: number, rBottom: number, h: number, seg = 16) { return this.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), cat, x, y + h / 2, z); }
  /** 바닥 y에서 시작하는 원뿔 */
  cone(cat: Cat, x: number, y: number, z: number, r: number, h: number, seg = 10) { return this.add(new THREE.ConeGeometry(r, h, seg), cat, x, y + h / 2, z); }
  /** 박공지붕(삼각기둥). span=처마 사이 폭, len=마루 방향 길이, rise=처마에서 마루까지, y=처마 높이. 마루는 지역 z축 방향 */
  gable(cat: Cat, x: number, y: number, z: number, span: number, len: number, rise: number, ry = 0) {
    const s = new THREE.Shape(); s.moveTo(-span / 2, 0); s.lineTo(span / 2, 0); s.lineTo(0, rise); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }); geo.translate(0, 0, -len / 2);
    return this.add(geo, cat, x, y, z, ry);
  }
  /** 작품 자리: 흰 판 + 어두운 테두리. cy=중심 높이, 판의 앞면이 ry 방향(+z 기준)을 본다 */
  art(x: number, cy: number, z: number, w: number, h: number, ry = 0, featured = false) {
    const g = new THREE.Group(); g.position.set(x, cy, z); g.rotation.y = ry;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.06), clay('frame')); frame.userData.cat = 'frame'; frame.castShadow = true;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), clay('art')); panel.position.z = 0.035; panel.userData.cat = 'art';
    g.add(frame, panel); this.root.add(g);
    if (featured) this.featured = panel;
    return g;
  }
  /** 이젤 위 작품(바닥 y). 작품 폭 w, 중심 높이 cy */
  easel(x: number, y: number, z: number, w: number, h: number, cy: number, ry = 0, featured = false) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.root.add(g);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, cy + h / 2 + 0.2, 0.08), clay('trunk')); leg.position.set(s * (w / 2 - 0.05), (cy + h / 2 + 0.2) / 2, -0.12); leg.rotation.x = -0.08; leg.castShadow = true; leg.userData.cat = 'trunk'; g.add(leg); }
    const sub = new Kit(); sub.art(0, cy, 0, w, h, 0, featured); g.add(...sub.root.children);
    if (featured) this.featured = sub.featured;
    return g;
  }
  /** 벤치(바닥 y). 길이 1.6m, 앉는 높이 0.45m, 등받이 0.85m. 등받이가 -z 쪽, 앉는 사람은 +z를 본다 */
  bench(x: number, y: number, z: number, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.root.add(g);
    const part = (w: number, h: number, d: number, px: number, py: number, pz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), clay('bench')); m.position.set(px, py + h / 2, pz); m.castShadow = m.receiveShadow = true; m.userData.cat = 'bench'; g.add(m); };
    part(1.6, 0.06, 0.45, 0, 0.39, 0); part(1.6, 0.4, 0.05, 0, 0.45, -0.22);
    for (const s of [-0.7, 0.7]) part(0.07, 0.39, 0.42, s, 0, 0);
    return g;
  }
  /** 침엽수(바닥 y): 줄기와 잎 덩어리 세 단. 활엽수: 줄기와 둥근 수관 */
  tree(x: number, y: number, z: number, height: number, kind: 'conifer' | 'broad' = 'conifer') {
    if (kind === 'conifer') {
      const trunkH = height * 0.22; this.cyl('trunk', x, y, z, 0.16, 0.24, trunkH, 8);
      const crown = height - trunkH, r = height * 0.2;
      for (let i = 0; i < 3; i++) this.cone('tree', x, y + trunkH + i * crown * 0.26, z, r * (1 - i * 0.22), crown * (0.62 - i * 0.1), 9);
    } else {
      const trunkH = height * 0.45; this.cyl('trunk', x, y, z, 0.14, 0.22, trunkH, 8);
      const r = height * 0.34; const c = this.add(new THREE.IcosahedronGeometry(r, 1), 'tree', x, y + trunkH + r * 0.7, z); c.scale.set(1, 0.85, 1);
    }
  }
  /** 작은 집(바닥 y): 벽·박공지붕·문. 문과 박공 끝이 ry 방향(+z 기준)을 본다 */
  house(x: number, y: number, z: number, o: { w: number; d: number; wall: number; ridge: number; doorW?: number; doorH?: number; ry?: number; overhang?: number }) {
    const ry = o.ry ?? 0, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.root.add(g);
    const sub = new Kit(); const ov = o.overhang ?? 0.5;
    sub.box('building', 0, 0, 0, o.w, o.wall, o.d);
    sub.gable('roof', 0, o.wall, 0, o.w + ov * 2, o.d + ov * 2, o.ridge - o.wall);
    // 박공 끝 벽(지붕 아래 삼각형)
    const tri = new THREE.Shape(); tri.moveTo(-o.w / 2, 0); tri.lineTo(o.w / 2, 0); tri.lineTo(0, (o.ridge - o.wall) * (o.w / (o.w + ov * 2))); tri.closePath();
    for (const s of [-1, 1]) { const m = sub.add(new THREE.ShapeGeometry(tri), 'building', 0, o.wall, s * (o.d / 2 - 0.01)); if (s < 0) m.rotation.y = Math.PI; }
    const dw = o.doorW ?? 1.4, dh = o.doorH ?? 2.4;
    sub.box('frame', 0, 0, o.d / 2, dw, dh, 0.08);
    g.add(...sub.root.children);
    return g;
  }
  /** 계단(바닥 y0→y1). zFrom→zTo로 올라간다. 폭 w */
  stairs(x: number, zFrom: number, zTo: number, y0: number, y1: number, w: number) {
    const n = Math.max(2, Math.round((y1 - y0) / 0.15)), run = (zTo - zFrom) / n, rise = (y1 - y0) / n;
    for (let i = 0; i < n; i++) this.box('path', x, y0, zFrom + run * (i + 0.5), w, rise * (i + 1), Math.abs(run) + 0.01);
  }
  /** 캐릭터(바닥 y): 키 1.58m(현재 모델 실측). 다리·몸·큰 머리 */
  avatar(x: number, y: number, z: number, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.root.add(g);
    const p = (geo: THREE.BufferGeometry, py: number) => { const m = new THREE.Mesh(geo, clay('avatar')); m.position.y = py; m.castShadow = true; m.userData.cat = 'avatar'; g.add(m); };
    for (const s of [-0.12, 0.12]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10), clay('avatar')); leg.position.set(s, 0.25, 0); leg.castShadow = true; leg.userData.cat = 'avatar'; g.add(leg); }
    p(new THREE.CylinderGeometry(0.2, 0.25, 0.48, 14), 0.74);
    p(new THREE.SphereGeometry(0.3, 18, 14), 1.28);
    return g;
  }
}
