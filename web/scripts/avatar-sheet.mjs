// 기본 캐릭터·그림 캐릭터 렌더 시트(3D미술관_재설계 §2-18 끝나는 조건). 로컬 확인 전용.
// 사용: 개발 서버(기본 http://127.0.0.1:9501)를 켠 뒤 `node scripts/avatar-sheet.mjs <출력폴더> [그림 경로]`
// 출력: default.png(4개 모드 × 앞·옆·뒤), drawn.png(그림 캐릭터 앞·옆·뒤, 그림을 주었을 때), metrics.json
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? '/private/tmp/uam-avatar-sheet');
const drawing = process.argv[3] ? readFileSync(resolve(process.argv[3])).toString('base64') : null;
const base = process.env.WORLD_URL ?? 'http://127.0.0.1:9501';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
await page.goto(`${base}/app/world`);
const threeUrl = await page.evaluate(async () => {
  const t = await (await fetch('/src/app/world/avatar.ts')).text();
  return /from "([^"]*three\.js[^"]*)"/.exec(t)?.[1] ?? null;
});
if (!threeUrl) throw new Error('three 모듈 주소를 찾지 못했습니다');

const metrics = await page.evaluate(async ({ threeUrl, drawing }) => {
  const THREE = await import(threeUrl);
  const av = await import('/src/app/world/avatar.ts');
  const cut = await import('/src/app/world/cutout.ts');
  const W = 200, H = 240, angles = [0, Math.PI / 2, Math.PI];
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace;
  const shot = (rig, a, ctx, x, y) => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9e4da');
    scene.add(new THREE.HemisphereLight('#ffffff', '#b9a58a', 1.6));
    const d = new THREE.DirectionalLight('#ffffff', 1.6); d.position.set(2, 4, 3); scene.add(d);
    rig.root.rotation.y = a; scene.add(rig.root);
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50); cam.position.set(0, 1.0, 4.2); cam.lookAt(0, 0.85, 0);
    r.render(scene, cam); ctx.drawImage(r.domElement, x, y); scene.remove(rig.root);
  };
  const sheet = (rows) => { const c = document.createElement('canvas'); c.width = W * 3; c.height = H * rows; return c; };
  const styles = ['classic', 'block', 'forest', 'toy'];
  const def = sheet(4), dctx = def.getContext('2d');
  styles.forEach((s, i) => { const rig = av.buildAvatar(av.DEFAULT_AVATAR, undefined, s); angles.forEach((a, k) => shot(rig, a, dctx, k * W, i * H)); rig.dispose(); });
  const result = { default: def.toDataURL('image/png'), drawn: null, thickness: null };
  if (drawing) {
    const blob = await (await fetch(`data:image/png;base64,${drawing}`)).blob();
    const img = await cut.blobToImage(blob), c = cut.drawToCanvas(img, 384), m = cut.removeBackground(c);
    const texture = new THREE.CanvasTexture(m.ok ? cut.cutoutCanvas(c, m) : c); texture.colorSpace = THREE.SRGBColorSpace;
    const rig = av.buildAvatar({ ...av.DEFAULT_AVATAR, mode: 'image', motion: 'whole' }, { texture, mask: m.ok ? m : null, aspect: c.width / c.height }, 'classic');
    const g = rig.skin.geometry; g.computeBoundingBox();
    // 몸 가운데 높이 띠의 앞뒤 두께 / 가로 폭(§2-18)
    const p = g.getAttribute('position'), bb = g.boundingBox, midY = (bb.min.y + bb.max.y) / 2, band = (bb.max.y - bb.min.y) * 0.08;
    let zMin = Infinity, zMax = -Infinity, xMin = Infinity, xMax = -Infinity;
    for (let i = 0; i < p.count; i++) { if (Math.abs(p.getY(i) - midY) > band) continue; zMin = Math.min(zMin, p.getZ(i)); zMax = Math.max(zMax, p.getZ(i)); xMin = Math.min(xMin, p.getX(i)); xMax = Math.max(xMax, p.getX(i)); }
    result.thickness = { maskOk: m.ok, maskRatio: m.ratio, depth: zMax - zMin, width: xMax - xMin, ratio: (zMax - zMin) / (xMax - xMin) };
    const dr = sheet(1); angles.forEach((a, k) => shot(rig, a, dr.getContext('2d'), k * W, 0));
    result.drawn = dr.toDataURL('image/png'); rig.dispose();
  }
  r.dispose();
  return result;
}, { threeUrl, drawing });

const save = (name, url) => { if (url) writeFileSync(resolve(out, name), Buffer.from(url.split(',')[1], 'base64')); };
save('default.png', metrics.default);
save('drawn.png', metrics.drawn);
writeFileSync(resolve(out, 'metrics.json'), JSON.stringify({ thickness: metrics.thickness }, null, 2));
console.log(JSON.stringify({ out, thickness: metrics.thickness }));
await browser.close();
