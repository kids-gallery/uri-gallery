// 공간 꾸미기(3D미술관_재설계 §2-15 "꾸미기 규칙"): 작품 옆 자리에 식물·등불·벤치를 놓는다.
// 자리는 좌표가 아니라 (작품 ID, 자리 이름)으로 저장하고, 공간이 바뀌면 작품 위치에서 다시 계산한다.
import * as THREE from 'three';

export type DecorKind = 'plant' | 'lamp' | 'bench';
export type DecorSpot = 'left' | 'right' | 'front';
export interface DecorItem { id: string; kind: DecorKind; work: string; spot: DecorSpot }
export const DECOR_KINDS: ReadonlyArray<{ id: DecorKind; label: string; spots: DecorSpot[] }> = [
  { id: 'plant', label: '식물', spots: ['left', 'right'] },
  { id: 'lamp', label: '등불', spots: ['left', 'right'] },
  { id: 'bench', label: '벤치', spots: ['front'] },
];
export const SPOT_LABEL: Record<DecorSpot, string> = { left: '왼쪽', right: '오른쪽', front: '작품 앞' };
export const isDecorItem = (v: unknown): v is DecorItem => {
  const o = v as DecorItem;
  return !!o && typeof o.id === 'string' && typeof o.work === 'string' && DECOR_KINDS.some((k) => k.id === o.kind && k.spots.includes(o.spot));
};

export interface Box2 { minX: number; maxX: number; minZ: number; maxZ: number }
export interface DecorPose { x: number; z: number; yaw: number; box: Box2 }
const SIZE: Record<DecorKind, [number, number]> = { plant: [0.56, 0.56], lamp: [0.46, 0.46], bench: [1.6, 0.56] }; // 가로(작품과 나란히)·깊이

/** 작품 자리(벽 또는 받침대)와 방 안쪽을 향한 법선에서 소품 자리를 계산한다. 왼쪽·오른쪽은 작품을 바라보는 사람 기준 */
export function decorPose(kind: DecorKind, type: 'wall' | 'pedestal', at: { x: number; z: number }, normal: { x: number; z: number }, spot: DecorSpot): DecorPose {
  const nx = normal.x, nz = normal.z, tx = nz, tz = -nx; // 작품을 바라볼 때(-n 방향) 오른쪽 = 앞 × 위 = (nz, -nx)
  const side = type === 'wall' ? 1.15 : 0.95, out = type === 'wall' ? 0.55 : 0;
  const front = type === 'wall' ? 3.4 : 2.9;
  const off = spot === 'front' ? { a: 0, b: front } : { a: spot === 'right' ? side : -side, b: out };
  const x = at.x + tx * off.a + nx * off.b, z = at.z + tz * off.a + nz * off.b;
  const yaw = Math.atan2(nx, nz);
  const [w, d] = SIZE[kind];
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
  return { x, z, yaw, box: { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz } };
}

export const overlaps = (a: Box2, b: Box2, pad = 0) => a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad;

export interface DecorContext {
  onFloor: (x: number, z: number) => boolean;
  hitsSolid: (b: Box2) => boolean;
  stands: Array<{ x: number; z: number }>;
  doors: Box2[];
  others: Box2[];
}

/** 놓을 수 없으면 사람에게 보일 이유, 놓을 수 있으면 null */
export function decorBlocked(p: DecorPose, ctx: DecorContext): string | null {
  const b = p.box, corners: Array<[number, number]> = [[b.minX, b.minZ], [b.maxX, b.minZ], [b.minX, b.maxZ], [b.maxX, b.maxZ], [p.x, p.z]];
  if (!corners.every(([x, z]) => ctx.onFloor(x, z))) return '바닥이 아닌 곳이에요';
  if (ctx.hitsSolid(b)) return '벽이나 받침대와 겹쳐요';
  if (ctx.others.some((o) => overlaps(b, o, 0.05))) return '다른 소품과 겹쳐요';
  if (ctx.stands.some((s) => s.x > b.minX - 0.75 && s.x < b.maxX + 0.75 && s.z > b.minZ - 0.75 && s.z < b.maxZ + 0.75)) return '작품 앞에 서는 자리를 막아요';
  if (ctx.doors.some((d) => overlaps(b, d))) return '문으로 드나드는 길을 막아요';
  return null;
}

// ───────────── 모양 ─────────────
const mats = {
  pot: new THREE.MeshStandardMaterial({ color: '#b5683f', roughness: 0.82 }),
  soil: new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4f7f3c', roughness: 0.7, flatShading: true }),
  leafLight: new THREE.MeshStandardMaterial({ color: '#6f9c4a', roughness: 0.7, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: '#a8743f', roughness: 0.72 }),
  woodDark: new THREE.MeshStandardMaterial({ color: '#6e4a2a', roughness: 0.8 }),
  iron: new THREE.MeshStandardMaterial({ color: '#34302b', roughness: 0.55, metalness: 0.4 }),
  glow: new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffc874', emissiveIntensity: 1.1, roughness: 0.4 }),
};
for (const m of Object.values(mats)) m.userData.shared = true;

function part(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m;
}

/** 소품 하나(바닥 y=0에 닿는다). 기하는 소품마다 새로 만들고 지울 때 함께 지운다 */
export function buildDecor(kind: DecorKind): THREE.Group {
  const g = new THREE.Group(); g.name = `decor-${kind}`;
  if (kind === 'plant') {
    part(g, new THREE.CylinderGeometry(0.24, 0.18, 0.42, 20), mats.pot, 0, 0.21, 0);
    part(g, new THREE.TorusGeometry(0.235, 0.03, 8, 24), mats.pot, 0, 0.42, 0).rotation.x = Math.PI / 2;
    part(g, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), mats.soil, 0, 0.4, 0);
    const blobs: Array<[number, number, number, number, boolean]> = [[0, 0.72, 0, 0.27, false], [0.14, 0.62, 0.08, 0.2, true], [-0.13, 0.64, -0.06, 0.21, true], [0.03, 0.9, -0.04, 0.18, false], [-0.05, 0.58, 0.15, 0.16, true]];
    for (const [x, y, z, r, light] of blobs) part(g, new THREE.IcosahedronGeometry(r, 1), light ? mats.leafLight : mats.leaf, x, y, z);
  } else if (kind === 'lamp') {
    part(g, new THREE.CylinderGeometry(0.2, 0.23, 0.06, 16), mats.iron, 0, 0.03, 0);
    part(g, new THREE.CylinderGeometry(0.035, 0.035, 1.05, 10), mats.iron, 0, 0.58, 0);
    part(g, new THREE.BoxGeometry(0.26, 0.3, 0.26), mats.glow, 0, 1.24, 0);
    for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]] as const) part(g, new THREE.BoxGeometry(0.03, 0.34, 0.03), mats.iron, x, 1.24, z);
    part(g, new THREE.ConeGeometry(0.24, 0.16, 4), mats.iron, 0, 1.47, 0, Math.PI / 4);
  } else {
    for (const dz of [-0.17, 0, 0.17]) part(g, new THREE.BoxGeometry(1.6, 0.05, 0.15), mats.wood, 0, 0.44, dz);
    for (const x of [-0.68, 0.68]) {
      part(g, new THREE.BoxGeometry(0.08, 0.42, 0.48), mats.woodDark, x, 0.21, 0);
      part(g, new THREE.BoxGeometry(0.08, 0.06, 0.5), mats.woodDark, x, 0.03, 0);
    }
  }
  return g;
}
