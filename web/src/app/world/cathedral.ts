// 대성당 실내 양식(3D미술관_재설계 §2-2 "대성당 실내"). 16~17세기 로마 바실리카의 공간 유형을 빌린다.
// 평면(바닥·문·작품 걸이 좌표·충돌)은 museum.ts 그대로 두고, 높이 방향 건축·재질·빛만 바꾼다. 특정 건물을 축척 복제하지 않는다.
import * as THREE from 'three';
import { worldUV } from './materials';

export interface CathedralPlan { R: number; Z0: number; zEnd: number; corW: number; corH: number; roomD: number; roomL: number; roomH: number; doorW: number; doorH: number; rooms: Array<{ side: -1 | 1; cz: number }> }

export const NAVE_WALL = 13;   // 신랑 벽 높이(그 위 반원통 천장)
export const DRUM_BASE = 18;   // 교차부 드럼 시작
const DRUM_H = 4;
const CHAPEL_WALL = 9;

const BASE = '/museum/world/materials/';
function tex(file: string, srgb: boolean, repeat: number) {
  const t = new THREE.TextureLoader().load(BASE + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.setScalar(repeat); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** 위에서 아래로 옅어지는 빛줄기 알파 */
function shaftTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 128;
  const g = c.getContext('2d');
  if (!g) { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; }
  // alphaMap은 초록 채널을 읽으므로 불투명한 회색조로 그린다
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#e6e6e6'); grad.addColorStop(0.55, '#595959'); grad.addColorStop(1, '#000000');
  g.fillStyle = grad; g.fillRect(0, 0, 8, 128);
  return new THREE.CanvasTexture(c);
}
/** 바닥에 떨어진 빛 웅덩이(가운데 밝고 가장자리 투명) */
function poolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; }
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#bdbdbd'); grad.addColorStop(1, '#000000');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Cathedral {
  readonly root = new THREE.Group();
  readonly mats: Record<'floor' | 'inlayRed' | 'inlayGreen' | 'stone' | 'marble' | 'gold' | 'stucco' | 'coffer' | 'window' | 'shaft' | 'pool' | 'dust', THREE.Material>;
  private dust: THREE.Points | null = null;
  private own = new Set<THREE.BufferGeometry>();
  private t = 0;

  constructor() {
    this.root.name = 'cathedral';
    const whiteMap = tex('white_marble_diff_1k.jpg', true, 0.45), whiteRough = tex('white_marble_rough_1k.jpg', false, 0.45);
    const stoneMap = tex('marble_01_diff_1k.jpg', true, 0.4), stoneNor = tex('marble_01_nor_gl_1k.jpg', false, 0.4), stoneRough = tex('marble_01_rough_1k.jpg', false, 0.4);
    const polished = (color: string) => new THREE.MeshPhysicalMaterial({ map: whiteMap, roughnessMap: whiteRough, color, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.7, side: THREE.DoubleSide });
    this.mats = {
      floor: polished('#ffffff'),
      inlayRed: polished('#a2473a'),
      inlayGreen: polished('#4c7560'),
      stone: new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneNor, roughnessMap: stoneRough, color: '#fbf7f0', roughness: 0.9, side: THREE.DoubleSide }),
      marble: new THREE.MeshPhysicalMaterial({ map: whiteMap, roughnessMap: whiteRough, color: '#fbf6ee', roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c9a04c', metalness: 1, roughness: 0.3, envMapIntensity: 1.1 }),
      stucco: new THREE.MeshStandardMaterial({ color: '#f4ede0', roughness: 0.82, side: THREE.DoubleSide }),
      coffer: new THREE.MeshStandardMaterial({ color: '#d8ccb6', roughness: 0.85 }),
      window: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.35, 1.95), side: THREE.DoubleSide }),
      shaft: new THREE.MeshBasicMaterial({ color: '#ffe7bd', alphaMap: shaftTexture(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      pool: new THREE.MeshBasicMaterial({ color: '#ffe2b0', alphaMap: poolTexture(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      dust: new THREE.PointsMaterial({ color: '#ffe9c4', size: 0.05, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    for (const m of Object.values(this.mats)) m.userData.shared = true;
  }

  /** 금·대리석 반사에 쓸 환경(엔진의 PMREM) */
  setEnv(env: THREE.Texture | null) {
    for (const k of ['floor', 'inlayRed', 'inlayGreen', 'marble', 'gold'] as const) { const m = this.mats[k] as THREE.MeshStandardMaterial; m.envMap = env; m.needsUpdate = true; }
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, uv = true) {
    this.own.add(geo); if (uv) worldUV(geo);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; this.root.add(m); return m;
  }
  private box(mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) { return this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); }
  /** 우물 반자 한 칸: 곡면 접선(t: 가로, b: 세로)과 법선 n에 맞춘 움푹한 칸과 가운데 금빛 장식 */
  private coffers(cells: Array<{ pos: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; w: number; h: number }>) {
    const panel: THREE.Matrix4[] = [], rose: THREE.Matrix4[] = [];
    for (const c of cells) {
      const n = c.n.clone().normalize(), t = c.t.clone().normalize(), b = new THREE.Vector3().crossVectors(n, t).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(t, b, n));
      panel.push(new THREE.Matrix4().compose(c.pos.clone().addScaledVector(n, -0.04), q, new THREE.Vector3(c.w, c.h, 0.12)));
      rose.push(new THREE.Matrix4().compose(c.pos.clone().addScaledVector(n, 0.04), q, new THREE.Vector3(c.w * 0.22, c.w * 0.22, 0.08)));
    }
    this.instances(new THREE.BoxGeometry(1, 1, 1), this.mats.coffer, panel);
    this.instances(new THREE.BoxGeometry(1, 1, 1), this.mats.gold, rose);
  }
  private instances(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[]) {
    this.own.add(geo); worldUV(geo);
    const m = new THREE.InstancedMesh(geo, mat, matrices.length); matrices.forEach((x, i) => m.setMatrixAt(i, x)); m.receiveShadow = true; this.root.add(m); return m;
  }
  private clear() {
    for (const c of [...this.root.children]) this.root.remove(c);
    for (const g of this.own) g.dispose(); this.own.clear(); this.dust = null;
  }

  /** 벽기둥: 받침·몸통·금빛 주두. 면 법선 n 쪽으로 튀어나온다 */
  private pilaster(x: number, z: number, h: number, rotY: number, w = 1.1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    const add = (mat: THREE.Material, y: number, ww: number, hh: number, dd: number, zz: number, xx = 0) => { const geo = new THREE.BoxGeometry(ww, hh, dd); this.own.add(geo); worldUV(geo); const m = new THREE.Mesh(geo, mat); m.position.set(xx, y, zz); m.receiveShadow = true; g.add(m); return m; };
    add(this.mats.marble, 0.35, w + 0.35, 0.7, 0.55, 0.27);
    add(this.mats.marble, h / 2, w, h - 1.5, 0.36, 0.18);
    for (let i = -2; i <= 2; i++) add(this.mats.stucco, h / 2, 0.07, h - 2.2, 0.05, 0.37, i * w / 5.5); // 세로 홈
    add(this.mats.gold, h - 0.55, w + 0.3, 0.5, 0.5, 0.25);
    add(this.mats.gold, h - 0.2, w + 0.5, 0.22, 0.62, 0.31);
    this.root.add(g);
  }

  build(p: CathedralPlan) {
    this.clear();
    const { R, Z0, zEnd, corW, corH } = p, half = corW / 2, alpha = Math.asin(half / R);
    const navLen = Z0 - zEnd, navC = (Z0 + zEnd) / 2;

    // ── 바닥 상감: 교차부 동심원, 신랑 사각 테와 원판 ──
    for (const [r0, r1, mat] of [[2.2, 2.7, this.mats.inlayRed], [4.6, 4.9, this.mats.inlayGreen], [7.4, 8.0, this.mats.inlayRed], [10.2, 10.45, this.mats.inlayGreen]] as const) {
      const ring = this.mesh(new THREE.RingGeometry(r0, r1, 96), mat, 0, 0.018, 0); ring.rotation.x = -Math.PI / 2;
    }
    const star = this.mesh(new THREE.CircleGeometry(1.2, 8), this.mats.inlayGreen, 0, 0.019, 0); star.rotation.x = -Math.PI / 2;
    for (let z = Z0 - 3; z > zEnd + 2; z -= 6) {
      const disc = this.mesh(new THREE.CircleGeometry(1.0, 48), this.mats.inlayRed, 0, 0.018, z); disc.rotation.x = -Math.PI / 2;
      const rim = this.mesh(new THREE.RingGeometry(1.0, 1.2, 48), this.mats.inlayGreen, 0, 0.019, z); rim.rotation.x = -Math.PI / 2;
      for (const x of [-half + 0.9, half - 0.9]) { const b = this.mesh(new THREE.PlaneGeometry(0.22, 5.2), this.mats.inlayGreen, x, 0.018, z); b.rotation.x = -Math.PI / 2; }
    }

    // ── 교차부: 벽 위 고리 벽(8→18), 신랑 쪽 아치 벽, 드럼과 창, 돔과 우물 반자, 채광창 ──
    const ring = this.mesh(new THREE.CylinderGeometry(R, R, DRUM_BASE - 8, 96, 1, true, Math.PI + alpha, Math.PI * 2 - 2 * alpha), this.mats.stone, 0, 8 + (DRUM_BASE - 8) / 2, 0);
    ring.material = this.mats.stone;
    const spandrel = new THREE.Shape(); spandrel.moveTo(-half, NAVE_WALL); spandrel.lineTo(-half, DRUM_BASE); spandrel.lineTo(half, DRUM_BASE); spandrel.lineTo(half, NAVE_WALL); spandrel.absarc(0, NAVE_WALL, half, 0, Math.PI, false);
    this.mesh(new THREE.ShapeGeometry(spandrel, 32), this.mats.stone, 0, 0, Z0 + 0.02);
    const arch = this.mesh(new THREE.TorusGeometry(half, 0.28, 8, 48, Math.PI), this.mats.gold, 0, NAVE_WALL, Z0 + 0.05); arch.scale.z = 0.6;
    for (const y of [NAVE_WALL, DRUM_BASE - 0.2]) { const c = this.mesh(new THREE.TorusGeometry(R - 0.25, 0.32, 6, 96), this.mats.marble, 0, y, 0, false); c.rotation.x = Math.PI / 2; }
    const gb = this.mesh(new THREE.TorusGeometry(R - 0.4, 0.1, 6, 96), this.mats.gold, 0, NAVE_WALL - 0.55, 0, false); gb.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { // 교차부 거대 벽기둥(신랑 입구 자리는 비움)
      const a = i * Math.PI / 6 + Math.PI / 12; if (Math.abs(((a - Math.PI) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < alpha + 0.12) continue;
      this.pilaster(Math.sin(a) * (R - 0.2), Math.cos(a) * (R - 0.2), NAVE_WALL, a + Math.PI);
    }
    this.mesh(new THREE.CylinderGeometry(R, R, DRUM_H, 96, 1, true), this.mats.stone, 0, DRUM_BASE + DRUM_H / 2, 0);
    const winM: THREE.Matrix4[] = [], frameM: THREE.Matrix4[] = [];
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8; const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI);
      winM.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * (R - 0.08), DRUM_BASE + DRUM_H / 2, Math.cos(a) * (R - 0.08)), q, new THREE.Vector3(1, 1, 1)));
      frameM.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * (R - 0.15), DRUM_BASE + DRUM_H / 2, Math.cos(a) * (R - 0.15)), q, new THREE.Vector3(1, 1, 1)));
    }
    this.instances(new THREE.PlaneGeometry(1.4, 2.6), this.mats.window, winM);
    this.instances(new THREE.BoxGeometry(1.9, 3.1, 0.12), this.mats.marble, frameM).position.set(0, 0, 0);
    const domeTop = DRUM_BASE + DRUM_H, domeH = 0.85;
    const dome = this.mesh(new THREE.SphereGeometry(R, 72, 28, 0, Math.PI * 2, 0.1, Math.PI / 2 - 0.1), this.mats.stucco, 0, domeTop, 0); dome.scale.y = domeH;
    const domeCells: Array<{ pos: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; w: number; h: number }> = [];
    for (let row = 0; row < 7; row++) { // 갈빗대 16칸 사이에 칸을 둔다. 위로 갈수록 작아진다
      const phi = Math.PI / 2 - 0.14 - row * 0.19, rr = (R - 0.14) * Math.sin(phi), per = 2;
      for (let k = 0; k < 16 * per; k++) {
        const th = (k + 0.5) / (16 * per) * Math.PI * 2;
        const pos = new THREE.Vector3(Math.sin(th) * rr, domeTop + (R - 0.14) * Math.cos(phi) * domeH, Math.cos(th) * rr);
        const n = new THREE.Vector3(0, domeTop, 0).sub(pos).multiply(new THREE.Vector3(1, 1 / domeH, 1)); // 안쪽(보는 쪽)
        const w = 2 * Math.PI * rr / (16 * per) * 0.72;
        domeCells.push({ pos, t: new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), n, w, h: Math.min(w, (R * 0.19) * 0.72) });
      }
    }
    this.coffers(domeCells);
    for (let i = 0; i < 16; i++) { // 자오선 갈빗대: XY 평면의 4분원 호를 Y축으로 돌려 나눈다
      const rib = this.mesh(new THREE.TorusGeometry(R - 0.1, 0.12, 6, 40, Math.PI / 2 - 0.1), this.mats.gold, 0, domeTop, 0, false); rib.rotation.y = i * Math.PI / 8; rib.scale.set(1, domeH, 1);
    }
    const lanternY = domeTop + R * Math.cos(0.1) * domeH;
    const oculus = this.mesh(new THREE.CircleGeometry(R * Math.sin(0.1), 48), this.mats.window, 0, lanternY + 0.05, 0, false); oculus.rotation.x = Math.PI / 2;
    const oRim = this.mesh(new THREE.TorusGeometry(R * Math.sin(0.1), 0.18, 8, 48), this.mats.gold, 0, lanternY, 0, false); oRim.rotation.x = Math.PI / 2;

    // ── 신랑: 벽 7→13, 벽기둥, 처마, 반원통 천장과 우물 반자, 고창과 빛줄기 ──
    for (const s of [-1, 1] as const) {
      const wall = this.mesh(new THREE.PlaneGeometry(navLen, NAVE_WALL - corH), this.mats.stone, s * half, corH + (NAVE_WALL - corH) / 2, navC); wall.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      const doors = p.rooms.filter((r) => r.side === s).map((r) => r.cz);
      for (let z = Z0 - 1.2; z > zEnd + 0.8; z -= 6) {
        if (doors.some((d) => Math.abs(d - z) < p.doorW / 2 + 0.8)) continue;
        this.pilaster(s * (half - 0.05), z, NAVE_WALL, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      const cornice = this.box(this.mats.marble, s * (half - 0.25), NAVE_WALL + 0.15, navC, 0.7, 0.45, navLen); cornice.castShadow = false;
      this.box(this.mats.gold, s * (half - 0.45), NAVE_WALL - 0.45, navC, 0.12, 0.18, navLen);
      for (let z = Z0 - 4.2; z > zEnd + 1.5; z -= 6) {
        const w = this.mesh(new THREE.PlaneGeometry(1.8, 2.6), this.mats.window, s * (half - 0.03), 10.1, z, false); w.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        const top = this.mesh(new THREE.CircleGeometry(0.9, 24, 0, Math.PI), this.mats.window, s * (half - 0.03), 11.4, z, false); top.rotation.y = w.rotation.y;
        const fr = this.mesh(new THREE.TorusGeometry(0.95, 0.12, 6, 24, Math.PI), this.mats.marble, s * (half - 0.08), 11.4, z, false); fr.rotation.y = w.rotation.y;
        if (s < 0) { // 한쪽에서만 빛이 들어온다(해가 한쪽에 있다)
          const shaft = this.mesh(new THREE.BoxGeometry(1.6, 13, 2.4), this.mats.shaft, -half + 4.2, 4.6, z, false); shaft.rotation.z = 0.62; shaft.renderOrder = 2; // 위쪽 끝이 왼쪽 창에 닿는다
          const pool = this.mesh(new THREE.PlaneGeometry(3.2, 3.6), this.mats.pool, -half + 7.8, 0.03, z, false); pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2;
        }
      }
    }
    const vault = this.mesh(new THREE.CylinderGeometry(half, half, navLen, 48, 1, true, -Math.PI / 2, Math.PI), this.mats.stucco, 0, NAVE_WALL, navC);
    vault.rotation.x = -Math.PI / 2; // 원기둥 축(y)을 z로 눕히고 반원을 위로
    const vaultCells: Array<{ pos: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; w: number; h: number }> = [];
    for (let z = Z0 - 1; z > zEnd + 0.8; z -= 2) for (let k = 1; k < 8; k++) {
      const th = k / 8 * Math.PI, pos = new THREE.Vector3(Math.cos(th) * (half - 0.12), NAVE_WALL + Math.sin(th) * (half - 0.12), z);
      vaultCells.push({ pos, t: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(-Math.cos(th), -Math.sin(th), 0), w: 1.45, h: 1.45 });
    }
    this.coffers(vaultCells);
    for (let z = Z0 - 1.2; z > zEnd + 0.8; z -= 6) { const rib = this.mesh(new THREE.TorusGeometry(half - 0.05, 0.22, 8, 40, Math.PI), this.mats.marble, 0, NAVE_WALL, z, false); rib.scale.z = 0.8; }
    // 끝벽: 7→18, 큰 아치 창
    const end = new THREE.Shape(); end.moveTo(-half, corH); end.lineTo(half, corH); end.lineTo(half, NAVE_WALL); end.absarc(0, NAVE_WALL, half, 0, Math.PI, false); end.lineTo(-half, corH);
    const endHole = new THREE.Path(); endHole.moveTo(-1.6, 8.6); endHole.lineTo(1.6, 8.6); endHole.lineTo(1.6, 12.6); endHole.absarc(0, 12.6, 1.6, 0, Math.PI, false); endHole.lineTo(-1.6, 8.6); end.holes.push(endHole);
    this.mesh(new THREE.ShapeGeometry(end, 32), this.mats.stone, 0, 0, zEnd + 0.02);
    const glass = new THREE.Shape(); glass.moveTo(-1.6, 8.6); glass.lineTo(1.6, 8.6); glass.lineTo(1.6, 12.6); glass.absarc(0, 12.6, 1.6, 0, Math.PI, false); glass.lineTo(-1.6, 8.6);
    this.mesh(new THREE.ShapeGeometry(glass, 24), this.mats.window, 0, 0, zEnd + 0.01, false);

    // ── 옆 예배당: 벽 6→9, 반원통 천장, 끝 반달 벽과 둥근 창, 문 아치 ──
    for (const r of p.rooms) {
      const s = r.side, cx = s * (half + p.roomD / 2), far = s * (half + p.roomD), rot = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      const wf = this.mesh(new THREE.PlaneGeometry(p.roomL, CHAPEL_WALL - p.roomH), this.mats.stone, far, p.roomH + (CHAPEL_WALL - p.roomH) / 2, r.cz); wf.rotation.y = rot;
      for (const dz of [-p.roomL / 2, p.roomL / 2]) {
        this.mesh(new THREE.PlaneGeometry(p.roomD, CHAPEL_WALL - p.roomH), this.mats.stone, cx, p.roomH + (CHAPEL_WALL - p.roomH) / 2, r.cz + dz);
        const lun = new THREE.Shape(); lun.absarc(0, 0, p.roomD / 2, 0, Math.PI, false); lun.lineTo(p.roomD / 2, 0);
        this.mesh(new THREE.ShapeGeometry(lun, 32), this.mats.stone, cx, CHAPEL_WALL, r.cz + dz + (dz > 0 ? -0.02 : 0.02));
      }
      const occ = this.mesh(new THREE.CircleGeometry(1.1, 32), this.mats.window, cx, CHAPEL_WALL + 2.2, r.cz - p.roomL / 2 + 0.05, false);
      occ.lookAt(cx, CHAPEL_WALL + 2.2, r.cz);
      const cv = this.mesh(new THREE.CylinderGeometry(p.roomD / 2, p.roomD / 2, p.roomL, 40, 1, true, -Math.PI / 2, Math.PI), this.mats.stucco, cx, CHAPEL_WALL, r.cz);
      cv.rotation.x = -Math.PI / 2;
      const cells: Array<{ pos: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3; w: number; h: number }> = [];
      for (let dz = -3.5; dz <= 3.5; dz += 1.75) for (let k = 1; k < 6; k++) {
        const th = k / 6 * Math.PI, pos = new THREE.Vector3(cx + Math.cos(th) * (p.roomD / 2 - 0.12), CHAPEL_WALL + Math.sin(th) * (p.roomD / 2 - 0.12), r.cz + dz);
        cells.push({ pos, t: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(-Math.cos(th), -Math.sin(th), 0), w: 1.3, h: 1.25 });
      }
      this.coffers(cells);
      this.box(this.mats.marble, far - s * 0.2, p.roomH - 0.15, r.cz, 0.5, 0.35, p.roomL);
      // 문 아치(폭 유지, 반원 머리)
      const da = this.mesh(new THREE.TorusGeometry(p.doorW / 2 + 0.15, 0.2, 8, 32, Math.PI), this.mats.marble, s * (half - 0.06), p.doorH, r.cz, false); da.rotation.y = rot;
      const key = this.box(this.mats.gold, s * (half - 0.12), p.doorH + p.doorW / 2 + 0.25, r.cz, 0.16, 0.5, 0.36); key.rotation.y = 0;
      for (const dz of [-1, 1]) this.box(this.mats.marble, s * (half - 0.08), p.doorH / 2, r.cz + dz * (p.doorW / 2 + 0.2), 0.2, p.doorH, 0.34);
    }

    // ── 떠다니는 먼지(빛줄기 근처) ──
    const pts = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) { const a = (i * 2.399) % (Math.PI * 2); const inNave = i % 3 !== 0; pts[i * 3] = inNave ? -half + 2 + (i * 7 % 50) / 10 : Math.sin(a) * (2 + (i % 9)); pts[i * 3 + 1] = 0.6 + (i * 13 % 110) / 10; pts[i * 3 + 2] = inNave ? zEnd + 2 + ((i * 37) % Math.max(1, Math.floor(navLen - 3))) : Math.cos(a) * (2 + (i % 9)); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3)); this.own.add(pg);
    this.dust = new THREE.Points(pg, this.mats.dust); this.root.add(this.dust);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.cathedral = true; });
  }

  update(dt: number, reduced: boolean) {
    if (reduced || !this.dust) return;
    this.t += dt; this.dust.position.y = Math.sin(this.t * 0.15) * 0.35; this.dust.rotation.y = Math.sin(this.t * 0.05) * 0.02;
  }

  dispose() { this.clear(); for (const m of Object.values(this.mats)) { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); } }
}
