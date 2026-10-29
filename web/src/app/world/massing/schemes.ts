// 숲 마을 큰 형태 3안과 현행 두 장면(3D미술관_재설계 §2-16). 회색 모형이며 치수는 설계서 표를 따른다.
// 도착 지점(spawn)에 선 캐릭터는 yaw=0일 때 -z를 본다(엔진 카메라 규칙과 같다).
import * as THREE from 'three';
import { Kit, clay, seeded, type Cat } from './kit';
import { createLayout, type Piece } from '../spatialLayout';
import { Outdoor } from '../outdoor';

export interface Scheme { id: string; title: string; kit: Kit; spawn: { x: number; y: number; z: number; yaw: number } }
type V = { x: number; y: number; z: number };

/** 두 점을 잇는 얇은 띠(길·데크). 기울어진 경사도 따른다 */
function ribbon(k: Kit, cat: Cat, a: V, b: V, w: number, thick = 0.04) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dz), m = k.add(new THREE.BoxGeometry(w, thick, Math.hypot(len, dy) + 0.02), cat, (a.x + b.x) / 2, (a.y + b.y) / 2 + thick / 2, (a.z + b.z) / 2);
  m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(dx, dz); m.rotation.x = -Math.atan2(dy, len);
  return m;
}
/** 지역 좌표(lx, lz)를 회전 ry로 세계 좌표에 옮긴다(+z 기준) */
const place = (c: { x: number; z: number }, ry: number, lx: number, lz: number) => ({ x: c.x + lx * Math.cos(ry) + lz * Math.sin(ry), z: c.z - lx * Math.sin(ry) + lz * Math.cos(ry) });

// ───────── A. 숲속 빈터 마을 ─────────
export function schemeA(): Scheme {
  const k = new Kit();
  const profile: Array<[number, number]> = [[0, 0], [19, 0], [21, 0.12], [24, 0.7], [27, 1.2], [90, 1.5]];
  const height = (r: number) => { for (let i = 1; i < profile.length; i++) { const [r0, y0] = profile[i - 1]!, [r1, y1] = profile[i]!; if (r <= r1) return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return 1.5; };
  k.add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 96), 'ground', 0, 0, 0);
  k.add(new THREE.RingGeometry(7, 9.5, 96).rotateX(-Math.PI / 2), 'path', 0, 0.02, 0);
  // 도착 길: 숲길(경사) → 문 → 마당 둘레 길
  ribbon(k, 'path', { x: 0, y: 0, z: 9.4 }, { x: 0, y: 0, z: 19 }, 3, 0.03);
  ribbon(k, 'path', { x: 0, y: 0, z: 19 }, { x: 0, y: height(36), z: 36 }, 3, 0.03);
  // 문: 게임 카메라(높이 약 4.1m)가 문 너머를 볼 수 있게 4.6m로 높이고 4.2m로 넓힌다(자체 검토 1회)
  for (const s of [-1, 1]) k.box('building', s * 2.1, 0, 19.5, 0.4, 4.6, 0.4);
  k.box('building', 0, 4.6, 19.5, 4.9, 0.35, 0.55);
  k.gable('roof', 0, 4.95, 19.5, 1.8, 5.5, 0.85, Math.PI / 2);
  // 중심: 마당 가운데 열린 정자와 큰 대표작 판(도착하자마자 작품이 있는 곳이 보이게)
  k.box('path', 0, 0, 0, 6.2, 0.3, 6.2);
  for (const x of [-2.3, 2.3]) for (const z of [-2.3, 2.3]) k.box('building', x, 0.3, z, 0.3, 3.0, 0.3);
  k.cone('roof', 0, 3.3, 0, 4.5, 2.4, 4).rotation.y = Math.PI / 4;
  k.easel(0, 0.3, 0.7, 2.2, 1.65, 1.75, 0, true);
  // 축 끝 본관(박공 끝과 문이 마당을 본다)
  k.house(0, 0, -16, { w: 9, d: 8, wall: 3.2, ridge: 7, doorW: 1.6, doorH: 2.6 });
  k.box('building', 2.6, 0, -18.5, 1, 8.6, 1);
  for (const s of [-1, 1]) k.box('building', s * 1.7, 0, -11.4, 0.22, 2.6, 0.22);
  k.gable('roof', 0, 2.6, -11.6, 4.2, 1.6, 0.9);
  k.art(-2.9, 1.35, -11.95, 1.1, 0.85, 0); k.art(2.9, 1.35, -11.95, 1.1, 0.85, 0);
  // 마당을 바라보는 작은 집 4채(창 전시 1점씩)
  for (const deg of [55, -55, 112, -112]) {
    const t = THREE.MathUtils.degToRad(deg), c = { x: 13.5 * Math.sin(t), z: -13.5 * Math.cos(t) }, ry = -t;
    k.house(c.x, 0, c.z, { w: 6, d: 6, wall: 2.8, ridge: 5.4, ry });
    const a = place(c, ry, 1.75, 3.08); k.art(a.x, 1.35, a.z, 1.0, 0.8, ry);
  }
  // 정자를 바라보는 벤치
  for (const deg of [35, -35, 145, -145]) { const t = THREE.MathUtils.degToRad(deg); k.bench(5.6 * Math.sin(t), 0, -5.6 * Math.cos(t), -t); }
  // 빈터 둘레 침엽수 고리, 집 사이 활엽수
  const rnd = seeded(7);
  for (let i = 0; i < 170; i++) {
    const a = rnd() * Math.PI * 2, r = 28 + rnd() * 24, x = r * Math.sin(a), z = -r * Math.cos(a);
    if (z > 18 && Math.abs(x) < 6) continue;
    k.tree(x, height(r), z, 10 + rnd() * 4.5, 'conifer');
  }
  for (const deg of [85, -85, 150, -150, 30, -30]) { const t = THREE.MathUtils.degToRad(deg), r = deg === 30 || deg === -30 ? 20.5 : 17.5; k.tree(r * Math.sin(t), height(r), -r * Math.cos(t), 7, 'broad'); }
  k.avatar(0, 0, 12.5);
  return { id: 'A', title: 'A. 숲속 빈터 마을', kit: k, spawn: { x: 0, y: 0, z: 12.5, yaw: 0 } };
}

// ───────── B. 언덕 위 긴 목조 미술관 ─────────
// 자체 검토 1회: 처음 안은 도착 지점이 건물에서 50m 넘게 떨어져 화면의 77%가 땅·길이었다. 단을 줄이고 건물을 앞으로 당겼다.
export function schemeB(): Scheme {
  const k = new Kit();
  k.add(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), 'ground', 0, 0, 0);
  k.box('ground', 0, 0, 4.5, 40, 0.9, 7);      // 첫째 단 z 1..8
  k.box('ground', 0, 0, -3.5, 40, 1.8, 9);     // 둘째 단(앞마당) z -8..1
  k.box('ground', 0, 0, -36.5, 48, 2.7, 57);   // 위쪽 평지 z -8..-65
  for (const s of [-1, 1]) k.box('ground', s * 36, 0, -24, 26, 4.5, 104); // 양옆 높은 숲 땅
  const hill = k.add(new THREE.SphereGeometry(1, 48, 24), 'ground', 0, -3, -92); hill.scale.set(50, 16, 32);
  k.stairs(0, 10.7, 8, 0, 0.9, 6); k.stairs(0, 3.7, 1, 0.9, 1.8, 6); k.stairs(0, -5.3, -8, 1.8, 2.7, 6);
  k.box('path', 0, 0.9, 5.85, 6, 0.02, 4.3);
  k.box('path', 0, 1.8, -2.15, 18, 0.02, 6.3);
  ribbon(k, 'path', { x: 0, y: 0, z: 10.7 }, { x: 0, y: 0, z: 30 }, 6, 0.03);
  k.easel(0, 1.8, -2.5, 2.2, 1.65, 1.75, 0, true);
  for (const s of [-1, 1]) k.bench(s * 5.8, 0.9, 5.6, -s * Math.PI / 2);
  // 한 채의 긴 집: 기단, 벽, 급한 박공지붕, 현관(정면 박공에 큰 작품 판)
  k.box('building', 0, 2.7, -28.5, 15, 0.5, 35);
  k.house(0, 3.2, -28.5, { w: 14, d: 33, wall: 4.5, ridge: 11, doorW: 3, doorH: 3.6, overhang: 0.8 });
  k.box('building', 0, 2.7, -10.2, 9, 0.5, 3.6);
  for (const x of [-3.7, 3.7]) for (const z of [-8.7, -11.6]) k.box('building', x, 3.2, z, 0.45, 3.0, 0.45);
  k.gable('roof', 0, 6.2, -10.1, 8.8, 4.2, 2.2);
  // 지붕 덩어리 앞면(z -11.2, 처마 0.8m) 바깥에 단다. 벽면(z -12)에 두면 지붕에 묻혀 안 보인다(자체 검토 2회)
  k.art(0, 10.3, -11.13, 4, 3, 0);
  for (let z = -14; z >= -44; z -= 4.5) for (const s of [-1, 1]) k.box('building', s * 7.25, 3.2, z, 0.5, 4.7, 0.5);
  const rnd = seeded(11);
  for (let i = 0; i < 70; i++) { const s = rnd() < 0.5 ? -1 : 1, x = s * (11 + rnd() * 11), z = -10 - rnd() * 52; k.tree(x, 2.7, z, 10 + rnd() * 4, 'conifer'); }
  for (let i = 0; i < 90; i++) { const s = rnd() < 0.5 ? -1 : 1; k.tree(s * (25 + rnd() * 22), 4.5, 26 - rnd() * 100, 10 + rnd() * 5, 'conifer'); }
  for (const s of [-1, 1]) { k.tree(s * 5.4, 0.9, 6.8, 7, 'broad'); k.tree(s * 7.5, 1.8, -1, 7, 'broad'); }
  for (let i = 0; i < 30; i++) { const s = rnd() < 0.5 ? -1 : 1; k.tree(s * (10 + rnd() * 12), 0, 10 + rnd() * 22, 7 + rnd() * 5, rnd() < 0.5 ? 'broad' : 'conifer'); }
  k.avatar(0, 0, 14);
  return { id: 'B', title: 'B. 언덕 위 긴 목조 미술관', kit: k, spawn: { x: 0, y: 0, z: 14, yaw: 0 } };
}

// ───────── C. 개울 따라 산책길 ─────────
export function schemeC(): Scheme {
  const k = new Kit();
  k.add(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), 'ground', 0, 0, 0);
  for (const s of [-1, 1]) { const side = k.add(new THREE.BoxGeometry(32, 1, 140), 'ground', s * 34, 1.7, -14); side.rotation.z = s * 0.11; } // 골짜기 비탈(바깥 3.5m)
  const hill = k.add(new THREE.SphereGeometry(1, 48, 24), 'ground', 8, -3, -86); hill.scale.set(40, 14, 24);
  const stream = new THREE.CatmullRomCurve3([[0, 26], [-1, 14], [-4, 2], [-5, -10], [-1, -22], [4, -34], [6, -44]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const N = 64, P = stream.getSpacedPoints(N), T = P.map((_, i) => stream.getTangentAt(i / N));
  const offset = (i: number, d: number) => { const t = T[i]!, p = P[i]!; return { x: p.x + t.z * -d, y: 0, z: p.z + t.x * d }; }; // 개울 진행 방향의 오른쪽으로 d
  for (let i = 0; i < N; i++) {
    ribbon(k, 'water', P[i]!, P[i + 1]!, 3.2, 0.04);
    for (const d of [-2.2, 2.2]) { const a = offset(i, d), b = offset(i + 1, d); ribbon(k, 'ground', a, b, 0.9, 0.35); }
  }
  // 데크 길: 개울 오른쪽 4.2m, 높이 0.42m 위
  const deck = (i: number) => ({ ...offset(i, -4.2), y: 0.3 });
  for (let i = 2; i < N - 1; i++) { ribbon(k, 'path', deck(i), deck(i + 1), 2.4, 0.12); if (i % 3 === 0) { const d = deck(i); k.box('trunk', d.x, 0, d.z, 0.14, 0.3, 0.14); } }
  const d0 = deck(2); k.box('path', d0.x, 0, d0.z + 1.5, 4, 0.42, 3); // 출발 데크(작게, 캐릭터 뒤)
  // 작품 쉼터 5개: 데크 바깥쪽, 박공 끝이 길을 본다
  const kiosks = [0.17, 0.32, 0.47, 0.62, 0.76].map((t) => Math.round(t * N));
  for (const i of kiosks) {
    const t = T[i]!, out = { x: t.z, z: -t.x }; // 진행 방향의 왼쪽 = 데크에서 개울 반대쪽(바깥)
    const p = deck(i), c = { x: p.x + out.x * 2.9, z: p.z + out.z * 2.9 }, ry = Math.atan2(-out.x, -out.z); // 쉼터 앞(+z)이 데크를 본다
    k.box('path', c.x, 0, c.z, 3.4, 0.42, 3.2, ry);
    for (const lx of [-1.4, 1.4]) for (const lz of [-1.1, 1.1]) { const q = place(c, ry, lx, lz); k.box('building', q.x, 0.42, q.z, 0.15, 2.4, 0.15); }
    k.gable('roof', c.x, 2.82, c.z, 3.7, 3.4, 1.0, ry);
    const back = place(c, ry, 0, -1.15); k.box('building', back.x, 0.42, back.z, 3.0, 2.3, 0.15, ry);
    const art = place(c, ry, 0, -1.05); k.art(art.x, 0.42 + 1.35, art.z, 1.0, 0.8, ry);
    const b = place(c, ry, 0, 0.75); k.bench(b.x, 0.42, b.z, ry + Math.PI);
  }
  // 길 끝 나무 위 전망 집과 대표작
  const end = deck(N - 1), tEnd = T[N - 1]!, c = { x: end.x + tEnd.x * 5, z: end.z + tEnd.z * 5 }, ryT = Math.atan2(-tEnd.x, -tEnd.z);
  for (const lx of [-2.2, 2.2]) for (const lz of [-2.2, 2.2]) { const q = place(c, ryT, lx, lz); k.box('trunk', q.x, 0, q.z, 0.4, 7, 0.4); }
  k.box('path', c.x, 7, c.z, 5.6, 0.3, 5.6, ryT);
  k.house(c.x, 7.3, c.z, { w: 4.2, d: 4.2, wall: 2.6, ridge: 4.5, ry: ryT, doorW: 1.2, doorH: 2.1 });
  const fa = place(c, ryT, 0, 2.15); k.art(fa.x, 7.3 + 1.3, fa.z, 2.4, 1.8, ryT, true);
  for (let j = 0; j < 4; j++) { const q = place(c, ryT, 3.4, 1.8 - j * 1.6); ribbon(k, 'path', { x: q.x, y: j * 1.75, z: q.z }, { ...place(c, ryT, 3.4, 0.2 - j * 1.6), y: (j + 1) * 1.75 }, 1.2, 0.12); }
  // 나무: 둑 바깥 양쪽 줄과 골짜기 비탈
  const rnd = seeded(21);
  for (let i = 0; i < N; i += 2) for (const s of [-1, 1]) {
    const dist = 9 + rnd() * 6, q = offset(i, s * dist);
    if (kiosks.some((ki) => { const kp = deck(ki); return Math.hypot(kp.x - q.x, kp.z - q.z) < 5.5; })) continue;
    if (i < N * 0.18 && Math.hypot(q.x - deck(3).x, q.z - deck(3).z) < 12) continue; // 출발 지점 카메라 시야를 막지 않게(자체 검토 1회)
    k.tree(q.x, 0, q.z, 8 + rnd() * 5, rnd() < 0.55 ? 'conifer' : 'broad');
  }
  for (let i = 0; i < 170; i++) { const s = rnd() < 0.5 ? -1 : 1, x = s * (19 + rnd() * 30), slope = Math.max(0, (Math.abs(x) - 18) * 0.11); k.tree(x, slope, 30 - rnd() * 100, 9 + rnd() * 5, 'conifer'); }
  const s0 = deck(3), t0 = T[3]!, yaw = Math.atan2(-t0.x, -t0.z);
  k.avatar(s0.x, 0.42, s0.z, yaw);
  return { id: 'C', title: 'C. 개울 따라 산책길', kit: k, spawn: { x: s0.x, y: 0.42, z: s0.z, yaw } };
}

// ───────── 현행 ─────────
const PIECE_CAT: Record<Piece['material'], Cat> = { floor: 'path', wall: 'building', column: 'building', trim: 'trunk', ceiling: 'roof', pedestal: 'building', carpet: 'path', skylight: 'building', landscape: 'ground', foliage: 'tree' };

/** 지금의 숲 마을(spatialLayout 숲, 전시실 4개)과 실제 작품 자리 */
export function currentVillage(): Scheme {
  const k = new Kit(), layout = createLayout('forest', 4, false);
  for (const p of layout.pieces) {
    const geo = p.kind === 'box' ? new THREE.BoxGeometry(p.w, p.h, p.d) : p.kind === 'cylinder' ? new THREE.CylinderGeometry(p.w / 2, p.w / 2, p.h, 24) : new THREE.ConeGeometry(p.w / 2, p.h, 10);
    const m = k.add(geo, PIECE_CAT[p.material], p.x, p.y, p.z); m.rotation.y = p.yaw ?? 0; m.rotation.z = p.roll ?? 0;
  }
  k.add(new THREE.PlaneGeometry(320, 320).rotateX(-Math.PI / 2), 'ground', 0, -0.81, 0);
  for (const r of layout.rooms) for (const dz of [-3.6, -1.2, 1.2, 3.6]) k.art(r.x + r.side * 4.82, 1.6, r.z + dz, 1.4, 1.05, r.side > 0 ? -Math.PI / 2 : Math.PI / 2);
  for (let i = 0; i < 5; i++) { const s = i % 2 === 0 ? -1 : 1; k.art(s * 11.7, 2.6, 3 + Math.floor(i / 2) * 4, 2.6, 2.0, s < 0 ? Math.PI / 2 : -Math.PI / 2); k.box('trunk', s * 11.75, 0, 3 + Math.floor(i / 2) * 4, 0.3, 1.6, 2.4); }
  k.easel(0, 0, 0.8, 1.6, 1.2, 1.6, 0, true);
  k.avatar(0, 0, 9);
  return { id: 'now-village', title: '현행: 숲 마을(들어간 뒤)', kit: k, spawn: { x: 0, y: 0, z: 9, yaw: 0 } };
}

/** 지금의 광장(숲 모드 바깥, 내 미술관 건물 하나). 재질만 같은 회색으로 바꾼다 */
export function currentPlaza(): Scheme {
  const k = new Kit(), o = new Outdoor();
  o.apply('forest'); o.setBuildings([{ id: 'mine', child: '우리 아이', style: 'column_temple', mine: true }]);
  const mats = (o as unknown as { mats: Record<string, THREE.Material> }).mats;
  const byMat = new Map<THREE.Material, Cat>([[mats.ground!, 'ground'], [mats.path!, 'path'], [mats.water!, 'water'], [mats.leaf!, 'tree'], [mats.stone!, 'building'], [mats.masonry!, 'building'], [mats.roof!, 'roof'], [mats.trim!, 'trunk'], [mats.glass!, 'building'], [mats.dark!, 'frame']]);
  o.sky.visible = false; o.clouds.visible = false;
  o.root.traverse((obj) => {
    if ((obj as THREE.Points).isPoints) { obj.visible = false; return; }
    const m = obj as THREE.Mesh; if (!m.isMesh) return;
    const cat = byMat.get(m.material as THREE.Material) ?? 'building';
    m.material = clay(cat); m.userData.cat = cat; m.castShadow = cat !== 'ground'; m.receiveShadow = true;
  });
  k.root.add(o.root);
  k.avatar(0, 0, 28);
  return { id: 'now-plaza', title: '현행: 광장(처음 화면)', kit: k, spawn: { x: 0, y: 0, z: 28, yaw: 0 } };
}

export const SCHEMES: Record<string, () => Scheme> = { 'now-plaza': currentPlaza, 'now-village': currentVillage, A: schemeA, B: schemeB, C: schemeC };
