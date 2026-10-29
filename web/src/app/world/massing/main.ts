// 회색 모형 촬영 페이지(3D미술관_재설계 §2-16). 개발 서버에서만 쓴다(web/massing.html). 제품 빌드에는 들어가지 않는다.
// 모든 안을 같은 렌더러·빛·카메라로 찍고, 덩어리별 화면 비중과 대표작 위치를 잰다.
import * as THREE from 'three';
import { ID_COLOR, type Cat } from './kit';
import { SCHEMES, type Scheme } from './schemes';

export type View = 'eye' | 'game' | 'overview' | 'plan';
const W = 1280, H = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
const label = document.createElement('div');
label.style.cssText = 'position:fixed;left:12px;top:10px;font:600 15px system-ui,sans-serif;color:#2c2a27;background:#ffffffd0;padding:4px 10px;border-radius:6px';
document.body.appendChild(label);

const scene = new THREE.Scene();
const SKY = new THREE.Color('#e4e2dd');
scene.background = SKY;
const hemi = new THREE.HemisphereLight('#f6f5f2', '#8a867e', 1.15);
const sun = new THREE.DirectionalLight('#ffffff', 1.75);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 300 });
scene.add(hemi, sun, sun.target);
const persp = new THREE.PerspectiveCamera(60, W / H, 0.1, 800);
const ortho = new THREE.OrthographicCamera(-70, 70, 43.75, -43.75, 1, 600);

let current: Scheme | null = null;
function load(id: string) {
  if (current?.id === id) return current;
  if (current) { scene.remove(current.kit.root); current.kit.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); }
  current = SCHEMES[id]!(); scene.add(current.kit.root); return current;
}

function aim(s: Scheme, view: View): THREE.Camera {
  const { x, y, z, yaw } = s.spawn, f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), at = new THREE.Vector3(x, y, z);
  const focus = at.clone().addScaledVector(f, 30);
  sun.position.copy(focus).add(new THREE.Vector3(-40, 60, 30)); sun.target.position.copy(focus);
  if (view === 'plan') {
    const c = at.clone().addScaledVector(f, 25);
    ortho.position.set(c.x, 200, c.z); ortho.up.copy(f); ortho.lookAt(c.x, 0, c.z); ortho.updateProjectionMatrix(); return ortho;
  }
  if (view === 'eye') { persp.position.set(x, y + 1.5, z); persp.lookAt(at.clone().addScaledVector(f, 20).setY(y + 1.5)); }
  else if (view === 'game') { // 지금 광장 카메라: 거리 9m, 기울기 0.32, 대상 높이 1.25m
    const target = at.clone().setY(y + 1.25), p = 0.32, d = 9;
    persp.position.set(target.x + Math.sin(yaw) * Math.cos(p) * d, target.y + Math.sin(p) * d, target.z + Math.cos(yaw) * Math.cos(p) * d); persp.lookAt(target);
  } else { persp.position.copy(at).addScaledVector(f, -45).setY(y + 38); persp.lookAt(focus); }
  persp.updateProjectionMatrix(); return persp;
}

/** 덩어리별 화면 비중(구분 색 렌더). 대표작은 따로 센다 */
function measure(s: Scheme, cam: THREE.Camera) {
  const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>(), basic = new Map<string, THREE.MeshBasicMaterial>();
  // 원래 재질의 앞뒤 설정을 따른다(뒷면이 보이는 지형이 측정에서 빠지지 않게)
  const mat = (c: string, side: THREE.Side) => { const key = `${c}:${side}`; let m = basic.get(key); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, side }); basic.set(key, m); } return m; };
  s.kit.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || !m.visible) return; saved.set(m, m.material); const side = (m.material as THREE.Material).side ?? THREE.FrontSide; m.material = mat(m === s.kit.featured ? '#ff80c0' : ID_COLOR[(m.userData.cat as Cat) ?? 'building'], side); });
  const rt = new THREE.WebGLRenderTarget(W, H); scene.background = new THREE.Color('#000000');
  const was = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  const prevCS = renderer.outputColorSpace; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.outputColorSpace = prevCS; renderer.shadowMap.enabled = was; scene.background = SKY; rt.dispose();
  for (const [m, original] of saved) m.material = original;
  const entries: Array<[string, string]> = [...Object.entries(ID_COLOR), ['featured', '#ff80c0']];
  const palette = entries.map(([k, c]) => { const col = new THREE.Color(c); return { k, r: Math.round(col.r * 255), g: Math.round(col.g * 255), b: Math.round(col.b * 255) }; });
  const counts: Record<string, number> = {};
  let fx0 = W, fx1 = -1, fy0 = H, fy1 = -1;
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4]!, g = px[i * 4 + 1]!, b = px[i * 4 + 2]!;
    let best = palette[0]!, bd = 1e9;
    for (const p of palette) { const d = (p.r - r) ** 2 + (p.g - g) ** 2 + (p.b - b) ** 2; if (d < bd) { bd = d; best = p; } }
    counts[best.k] = (counts[best.k] ?? 0) + 1;
    if (best.k === 'featured') { const x = i % W, y = Math.floor(i / W); fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
  }
  const share = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, +(100 * n / (W * H)).toFixed(2)]));
  const featured = fx1 < 0 ? null : { centerX: +(((fx0 + fx1) / 2) / W - 0.5).toFixed(3), centerY: +(0.5 - ((fy0 + fy1) / 2) / H).toFixed(3), widthPct: +(100 * (fx1 - fx0 + 1) / W).toFixed(1) };
  return { share, featured };
}

async function show(id: string, view: View) {
  const s = load(id), cam = aim(s, view);
  label.textContent = `${s.title} · ${{ eye: '입구 눈높이(1.5m)', game: '입구 게임 시점(9m 뒤)', overview: '전체 배치', plan: '평면(가로 140m, 위가 진행 방향)' }[view]}`;
  renderer.render(scene, cam);
  const stats = view === 'plan' ? null : measure(s, cam);
  renderer.render(scene, cam);
  return { id, view, title: s.title, stats };
}

(window as unknown as { __massing: unknown }).__massing = { show, ids: Object.keys(SCHEMES) };
