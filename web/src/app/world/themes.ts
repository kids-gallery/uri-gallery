// 배경 모드 4종. 실내 재질과 조명; 입체 구조는 spatialLayout/spatialScene, 외부는 Outdoor가 담당한다.
// 재질 객체를 재사용하되, 구조도 모드별로 다시 만든다.
import * as THREE from 'three';

export type ThemeId = 'classic' | 'block' | 'forest' | 'toy';

export const THEMES: ReadonlyArray<{ id: ThemeId; label: string; note: string; swatch: [string, string, string] }> = [
  { id: 'classic', label: '클래식', note: '높은 돔 아래 대리석 신랑을 따라 나이별 예배당에서 작품을 만나는 대성당 미술관', swatch: ['#f4ece0', '#b98e63', '#c4785a'] },
  { id: 'block', label: '블록', note: '어긋난 공방과 갈림길에서 만나는 만들기 전시', swatch: ['#8d8d8d', '#b8945f', '#5fa043'] },
  { id: 'forest', label: '숲 마을', note: '나무 사이 작은 전시집을 잇는 산책길', swatch: ['#e8c99a', '#cfe8d5', '#a8d58f'] },
  { id: 'toy', label: '장난감', note: '큰 테이블 위 둥근 전시섬을 오가는 미술관', swatch: ['#ffd23f', '#e63946', '#3a86ff'] },
];

export const TILE = 2; // 질감 한 장이 덮는 길이(m). 기하 UV는 m ÷ TILE로 맞춘다.

export type MatKey = 'floor' | 'wall' | 'column' | 'ceiling' | 'carpet' | 'pedestal' | 'trim' | 'skylight';

interface Look { map?: THREE.Texture; color: string; roughness: number; metalness: number; emissive?: string }
interface ThemeSpec {
  sky: string;
  hemi: [string, string, number];
  sun: [string, number];
  looks: Record<MatKey, () => Look>;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number, r: () => number) => void, seed: number, pixel = false): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; }
  else t.anisotropy = 4;
  return t;
}

function speckle(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, color: string, maxA: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = color;
    g.globalAlpha = r() * maxA;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
  g.globalAlpha = 1;
}

function veins(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, color: string) {
  g.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    g.lineWidth = 0.6 + r() * 1.6;
    g.globalAlpha = 0.15 + r() * 0.25;
    g.beginPath();
    const x = r() * s, y = r() * s;
    g.moveTo(x, y);
    g.bezierCurveTo(x + (r() - 0.5) * s * 0.6, y + (r() - 0.5) * s * 0.6, x + (r() - 0.5) * s, y + (r() - 0.5) * s, x + (r() - 0.5) * s, y + (r() - 0.5) * s);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** 16×16 픽셀 블록(마인크래프트 모티브의 일반 패턴, 실제 게임 질감 아님) */
function pixelBlocks(g: CanvasRenderingContext2D, s: number, r: () => number, base: [number, number, number], spread: number, edge: number, planks = false) {
  const cell = s / 2;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const k = (r() - 0.5) * spread;
    let [rr, gg, bb] = base;
    if (planks && y % (cell / 4) === 0) { rr -= 40; gg -= 35; bb -= 25; }
    if (x % cell === 0 || y % cell === 0) { rr -= edge; gg -= edge; bb -= edge; }
    g.fillStyle = `rgb(${Math.max(0, rr + k)},${Math.max(0, gg + k)},${Math.max(0, bb + k)})`;
    g.fillRect(x, y, 1, 1);
  }
}

function studs(g: CanvasRenderingContext2D, s: number, base: string, n: number) {
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  const step = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cx = x * step + step / 2, cy = y * step + step / 2;
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.arc(cx + 2, cy + 3, step * 0.32, 0, Math.PI * 2); g.fill();
    g.fillStyle = base;
    g.beginPath(); g.arc(cx, cy, step * 0.32, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.beginPath(); g.arc(cx - step * 0.08, cy - step * 0.08, step * 0.14, 0, Math.PI * 2); g.fill();
  }
}

function boards(g: CanvasRenderingContext2D, s: number, r: () => number, base: string, rows: number, gap: string) {
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  const h = s / rows;
  for (let i = 0; i < rows; i++) {
    g.fillStyle = `rgba(120,80,40,${0.04 + r() * 0.08})`;
    g.fillRect(0, i * h, s, h);
    g.strokeStyle = 'rgba(120,80,40,.18)';
    for (let k = 0; k < 5; k++) {
      g.lineWidth = 1;
      g.beginPath();
      const y = i * h + r() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 6, s * 0.6, y + (r() - 0.5) * 6, s, y);
      g.stroke();
    }
    g.fillStyle = gap;
    g.fillRect(0, i * h, s, 2);
    const off = (i % 2) * s / 2 + r() * s * 0.2;
    g.fillRect(off % s, i * h, 2, h);
  }
}

const SPECS: Record<ThemeId, ThemeSpec> = {
  classic: {
    sky: '#cfe3f5', hemi: ['#fff7ea', '#b9a58a', 1.15], sun: ['#fff1d6', 1.25],
    looks: {
      // §2-14 미술 방향: 바닥·벽·러그는 채도를 낮춘 무광 재질로 물러나고, 아이 작품의 색이 가장 먼저 읽히게 한다
      // 마지막 시각 보정: 바닥만 중간 명도의 나무로 낮춰 밝은 벽·받침대·러그와 경계가 읽히게 한다(벽·작품 색은 그대로)
      floor: () => ({ color: '#ffffff', roughness: 0.78, metalness: 0, map: canvasTex(256, (g, s, r) => boards(g, s, r, '#b98e63', 5, 'rgba(78,52,30,.5)'), 11) }),
      wall: () => ({ color: '#ffffff', roughness: 0.95, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#f4ece0'; g.fillRect(0, 0, s, s); speckle(g, s, r, 700, '#d9ccb6', 0.12);
      }, 12) }),
      column: () => ({ color: '#ffffff', roughness: 0.4, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#f5f0e7'; g.fillRect(0, 0, s, s); veins(g, s, r, 8, '#b9ab95');
      }, 13) }),
      ceiling: () => ({ color: '#ffffff', roughness: 0.85, metalness: 0, map: canvasTex(256, (g, s) => {
        g.fillStyle = '#efe4cf'; g.fillRect(0, 0, s, s);
        const n = 4, c = s / n;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          g.fillStyle = '#d9c7a4'; g.fillRect(x * c + 6, y * c + 6, c - 12, c - 12);
          g.fillStyle = '#f4ead6'; g.fillRect(x * c + 12, y * c + 12, c - 24, c - 24);
        }
      }, 14) }),
      carpet: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#d8c8ad'; g.fillRect(0, 0, s, s);
        g.strokeStyle = 'rgba(255,248,232,.5)'; g.lineWidth = 3;
        for (let i = 16; i < s; i += 48) { g.strokeRect(i, i, s - 2 * i, s - 2 * i); }
        speckle(g, s, r, 900, '#a8977a', 0.18);
      }, 15) }),
      pedestal: () => ({ color: '#ffffff', roughness: 0.35, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#f7f3ec'; g.fillRect(0, 0, s, s); veins(g, s, r, 10, '#b3a58f');
      }, 16) }),
      trim: () => ({ color: '#c9a24a', roughness: 0.35, metalness: 0.75 }),
      skylight: () => ({ color: '#fff6df', roughness: 1, metalness: 0, emissive: '#fff6df' }),
    },
  },
  block: {
    sky: '#8fc7ff', hemi: ['#ffffff', '#7a6a55', 1.05], sun: ['#ffffff', 1.35],
    looks: {
      floor: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(32, (g, s, r) => pixelBlocks(g, s, r, [138, 138, 138], 34, 28), 21, true) }),
      wall: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(32, (g, s, r) => pixelBlocks(g, s, r, [184, 148, 95], 22, 36, true), 22, true) }),
      column: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(32, (g, s, r) => pixelBlocks(g, s, r, [120, 120, 120], 60, 20), 23, true) }),
      ceiling: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(32, (g, s, r) => pixelBlocks(g, s, r, [122, 90, 58], 20, 30, true), 24, true) }),
      carpet: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(32, (g, s, r) => pixelBlocks(g, s, r, [95, 160, 67], 40, 18), 25, true) }),
      pedestal: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(32, (g, s, r) => pixelBlocks(g, s, r, [150, 150, 150], 24, 45), 26, true) }),
      trim: () => ({ color: '#6b4a2b', roughness: 1, metalness: 0 }),
      skylight: () => ({ color: '#ffffff', roughness: 1, metalness: 0, emissive: '#ffffff' }),
    },
  },
  forest: {
    sky: '#ffd9b3', hemi: ['#fff2e0', '#b5d6a7', 1.2], sun: ['#ffd7a8', 1.05],
    looks: {
      floor: () => ({ color: '#ffffff', roughness: 0.75, metalness: 0, map: canvasTex(256, (g, s, r) => boards(g, s, r, '#e8c99a', 6, 'rgba(150,100,55,.45)'), 31) }),
      wall: () => ({ color: '#ffffff', roughness: 0.95, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#d6eedb'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 70; i++) {
          g.fillStyle = r() < 0.5 ? 'rgba(120,180,120,.35)' : 'rgba(255,255,255,.55)';
          g.beginPath(); g.ellipse(r() * s, r() * s, 3 + r() * 4, 1.5 + r() * 2, r() * Math.PI, 0, Math.PI * 2); g.fill();
        }
      }, 32) }),
      column: () => ({ color: '#ffffff', roughness: 0.9, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#f3f0e8'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,40,40,.6)'; g.fillRect(r() * s, r() * s, 6 + r() * 18, 2 + r() * 2); }
      }, 33) }),
      ceiling: () => ({ color: '#ffffff', roughness: 0.85, metalness: 0, map: canvasTex(256, (g, s, r) => boards(g, s, r, '#f1dcb8', 5, 'rgba(160,110,60,.35)'), 34) }),
      carpet: () => ({ color: '#ffffff', roughness: 1, metalness: 0, map: canvasTex(256, (g, s, r) => {
        g.fillStyle = '#a8d58f'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 90; i++) {
          g.fillStyle = r() < 0.5 ? '#ffffff' : '#ffb6c9';
          const x = r() * s, y = r() * s;
          for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 3, y + Math.sin(k * 1.26) * 3, 2.2, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
        }
      }, 35) }),
      pedestal: () => ({ color: '#ffffff', roughness: 0.8, metalness: 0, map: canvasTex(256, (g, s) => {
        g.fillStyle = '#c99a62'; g.fillRect(0, 0, s, s);
        for (let i = 1; i < 12; i++) { g.strokeStyle = `rgba(110,70,30,${0.15 + (i % 2) * 0.1})`; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s / 2, i * 11, 0, Math.PI * 2); g.stroke(); }
      }, 36) }),
      trim: () => ({ color: '#b07a45', roughness: 0.7, metalness: 0 }),
      skylight: () => ({ color: '#fff1d0', roughness: 1, metalness: 0, emissive: '#fff1d0' }),
    },
  },
  toy: {
    sky: '#a7d8ff', hemi: ['#ffffff', '#c9d3e0', 1.3], sun: ['#ffffff', 1.05],
    looks: {
      floor: () => ({ color: '#ffffff', roughness: 0.35, metalness: 0, map: canvasTex(256, (g, s) => studs(g, s, '#a8dc8a', 8), 41) }),
      wall: () => ({ color: '#ffffff', roughness: 0.35, metalness: 0, map: canvasTex(256, (g, s) => {
        g.fillStyle = '#ffd23f'; g.fillRect(0, 0, s, s);
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, s / 2 - 2, s, 4); g.fillRect(s / 2 - 2, 0, 4, s);
      }, 42) }),
      column: () => ({ color: '#ffffff', roughness: 0.3, metalness: 0, map: canvasTex(256, (g, s) => {
        g.fillStyle = '#e63946'; g.fillRect(0, 0, s, s);
        g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < s; i += 32) g.fillRect(i, 0, 8, s);
      }, 43) }),
      ceiling: () => ({ color: '#ffffff', roughness: 0.4, metalness: 0, map: canvasTex(256, (g, s) => studs(g, s, '#f4f6fa', 4), 44) }),
      carpet: () => ({ color: '#ffffff', roughness: 0.4, metalness: 0, map: canvasTex(256, (g, s) => studs(g, s, '#3fb950', 8), 45) }),
      pedestal: () => ({ color: '#ffffff', roughness: 0.35, metalness: 0, map: canvasTex(256, (g, s) => studs(g, s, '#3a86ff', 4), 46) }),
      trim: () => ({ color: '#ffd23f', roughness: 0.3, metalness: 0 }),
      skylight: () => ({ color: '#e8f6ff', roughness: 1, metalness: 0, emissive: '#e8f6ff' }),
    },
  },
};

export function isThemeId(v: unknown): v is ThemeId {
  return v === 'classic' || v === 'block' || v === 'forest' || v === 'toy';
}

/** 모드별 바깥 장식(로비 화분 · 나무 · 장난감). 모두 처음에 만들어 두고 보이기만 바꾼다. */
function decorFor(id: ThemeId, anchors: THREE.Vector3[]): THREE.Group {
  const g = new THREE.Group();
  g.name = `decor-${id}`;
  const m = (c: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });
  for (const [i, p] of anchors.entries()) {
    const o = new THREE.Group();
    o.position.copy(p);
    if (id === 'classic') {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.6, 20), m('#b8673d'));
      pot.position.y = 0.3;
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), m('#4d7a3a'));
      bush.position.y = 1.15;
      o.add(pot, bush);
    } else if (id === 'block') {
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), m('#6b4a2b', 1));
      trunk.position.y = 0.65;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), m(i % 2 ? '#4f9a3a' : '#3f8a2e', 1));
      leaf.position.y = 1.75;
      o.add(trunk, leaf);
    } else if (id === 'forest') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.2, 12), m('#8a5a34'));
      trunk.position.y = 0.6;
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), m('#8cc97a'));
      a.position.y = 1.55;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), m('#a9dc94'));
      b.position.set(0.35, 1.95, 0.1);
      o.add(trunk, a, b);
      for (let k = 0; k < 5; k++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), m(k % 2 ? '#ff9db5' : '#ffffff'));
        f.position.set(Math.cos(k * 1.25) * 0.8, 0.09, Math.sin(k * 1.25) * 0.8);
        o.add(f);
      }
    } else {
      const colors = ['#e63946', '#3a86ff', '#ffd23f', '#3fb950'];
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.8 - k * 0.15, 0.45, 0.8 - k * 0.15), m(colors[(i + k) % 4]!, 0.35));
        b.position.y = 0.225 + k * 0.45;
        b.rotation.y = k * 0.35;
        o.add(b);
      }
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 20), m(colors[(i + 3) % 4]!, 0.35));
      cone.position.y = 1.65;
      o.add(cone);
    }
    g.add(o);
  }
  g.visible = false;
  return g;
}

export class ThemeManager {
  readonly mats: Record<MatKey, THREE.MeshStandardMaterial>;
  private cache = new Map<ThemeId, Record<MatKey, Look>>();
  private decor = new Map<ThemeId, THREE.Group>();
  current: ThemeId = 'classic';

  constructor() {
    const mk = (side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ side });
    this.mats = {
      floor: mk(), wall: mk(THREE.DoubleSide), column: mk(), ceiling: mk(THREE.DoubleSide),
      carpet: mk(), pedestal: mk(), trim: mk(), skylight: mk(THREE.DoubleSide),
    };
    // 처음 한 번 클래식 질감으로 채워 셰이더 모양(map 있음/없음)을 고정한다
    this.fill('classic');
  }

  private looks(id: ThemeId): Record<MatKey, Look> {
    let l = this.cache.get(id);
    if (!l) {
      const spec = SPECS[id].looks;
      l = Object.fromEntries((Object.keys(spec) as MatKey[]).map((k) => [k, spec[k]()])) as Record<MatKey, Look>;
      this.cache.set(id, l);
    }
    return l;
  }

  private fill(id: ThemeId) {
    const l = this.looks(id);
    for (const k of Object.keys(this.mats) as MatKey[]) {
      const m = this.mats[k];
      const look = l[k];
      m.map = look.map ?? null;
      m.color.set(look.color);
      m.roughness = look.roughness;
      m.metalness = look.metalness;
      if (look.emissive) { m.emissive.set(look.emissive); m.emissiveIntensity = 1; }
      else { m.emissive.set('#000000'); m.emissiveIntensity = 0; }
    }
  }

  /** 모드별 장식을 만들어 장면에 붙인다(보이기는 apply가 정한다) */
  buildDecor(parent: THREE.Object3D, anchors: THREE.Vector3[]) {
    for (const t of THEMES) {
      const g = decorFor(t.id, anchors);
      this.decor.set(t.id, g);
      parent.add(g);
    }
  }

  /** 모든 모드의 질감을 미리 GPU에 올리고 장식 셰이더를 만든다(첫 전환 때 멈칫하지 않게) */
  warm(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    for (const t of THEMES) {
      const l = this.looks(t.id);
      for (const k of Object.keys(l) as MatKey[]) { const map = l[k].map; if (map) renderer.initTexture(map); }
    }
    const was = [...this.decor.entries()].map(([id, g]) => [id, g.visible] as const);
    for (const g of this.decor.values()) g.visible = true;
    renderer.compile(scene, camera);
    for (const [id, v] of was) this.decor.get(id)!.visible = v;
  }

  apply(id: ThemeId, scene: THREE.Scene, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
    const spec = SPECS[id];
    this.fill(id);
    scene.background = new THREE.Color(spec.sky);
    hemi.color.set(spec.hemi[0]);
    hemi.groundColor.set(spec.hemi[1]);
    hemi.intensity = spec.hemi[2];
    sun.color.set(spec.sun[0]);
    sun.intensity = spec.sun[1];
    for (const [k, g] of this.decor) g.visible = k === id;
    this.current = id;
  }
}

/** 기하 UV를 미터 기준으로 늘린다(질감 한 장 = TILE m) */
export function scaleUV(geo: THREE.BufferGeometry, sx: number, sy: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}
