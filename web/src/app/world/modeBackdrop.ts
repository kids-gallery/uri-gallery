// 블록과 숲의 둘레(마스터플랜 3-3 #137). 하늘과 빈 바닥 대신 공간 안에 있는 느낌을 준다.
// 걷는 길 밖에만 두고 충돌은 넣지 않는다. 벽과 둘레는 안개와 빛의 영향을 받지 않아 어느 시간대에도 같게 보인다.
import * as THREE from 'three';
import { paint, type TableBounds } from './toyRoom';

/** 블록 모드: 벽돌 공방. 창문과 선반이 있는 벽, 나무 바닥, 쌓인 상자 */
export function buildBlockRoom(t: TableBounds) {
  const group = new THREE.Group();
  group.name = 'block-room';
  const pixel = (x: THREE.Texture) => { x.magFilter = THREE.NearestFilter; x.minFilter = THREE.NearestMipmapNearestFilter; return x; };
  const wallTex = pixel(paint(512, 205, (g) => {
    g.fillStyle = '#b5654a'; g.fillRect(0, 0, 512, 205);
    g.fillStyle = 'rgba(70,35,25,.5)';
    for (let y = 0; y < 205; y += 16) { g.fillRect(0, y, 512, 2); for (let x = (y / 16) % 2 ? 0 : 16; x < 512; x += 32) g.fillRect(x, y, 2, 16); }
    g.fillStyle = '#6d5238'; g.fillRect(0, 150, 512, 55);
    g.fillStyle = '#4e3a27'; g.fillRect(0, 148, 512, 5);
    // 창문 둘
    for (const left of [70, 322]) {
      g.fillStyle = '#e8dcc2'; g.fillRect(left, 28, 120, 100);
      g.fillStyle = '#9fd8ff'; g.fillRect(left + 7, 35, 106, 86);
      g.fillStyle = '#ffffff'; g.fillRect(left + 20, 50, 34, 10); g.fillRect(left + 62, 72, 28, 8);
      g.fillStyle = '#e8dcc2'; g.fillRect(left + 57, 35, 6, 86); g.fillRect(left + 7, 75, 106, 6);
    }
    // 판벽 앞 도구 선반
    const tools = ['#e63946', '#3a86ff', '#ffd23f', '#3fb950'];
    g.fillStyle = '#8a6a48'; g.fillRect(205, 162, 102, 6); g.fillRect(205, 186, 102, 6);
    for (let i = 0; i < 12; i++) { g.fillStyle = tools[i % 4]!; g.fillRect(208 + i * 8, 170 - (i % 2) * 4, 6, 16 + (i % 2) * 4); }
  }));
  const floorTex = pixel(paint(256, 256, (g) => {
    g.fillStyle = '#7b5a3c'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(40,25,10,.4)'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 2);
  }));
  const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, ...o });
  const wall = basic({ map: wallTex }), floor = basic({ map: floorTex }), ceiling = basic({ color: '#d9cdb8' });
  const margin = 24, height = 70, baseY = -1.1;
  const w = t.maxX - t.minX + margin * 2, d = t.maxZ - t.minZ + margin * 2;
  const room = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), [wall, wall, ceiling, floor, wall, wall]);
  room.position.set((t.minX + t.maxX) / 2, baseY + height / 2, (t.minZ + t.maxZ) / 2);
  group.add(room);
  const color = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0 });
  const crate = color('#b98a55'), red = color('#c8553d'), blue = color('#3a6ea5'), yellow = color('#e0b23c');
  const box = (m: THREE.Material, x: number, y: number, z: number, s: number, yaw = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), m);
    o.position.set(x, y + s / 2, z); o.rotation.y = yaw; group.add(o);
  };
  // 양옆 벽을 따라 쌓인 상자(전시실이 끝나는 곳보다 바깥)
  for (const side of [-1, 1]) {
    const x = (side < 0 ? t.minX : t.maxX) - side * 10;
    for (const [z, s, m] of [[t.minZ + 18, 10, crate], [(t.minZ + t.maxZ) / 2, 8, red], [t.maxZ - 16, 9, blue]] as const) {
      box(m, x, 0, z, s, 0.3 * side);
      box(side < 0 ? yellow : crate, x, s, z, s * 0.6, -0.2 * side);
    }
  }
  return { group, materials: [wall, floor, ceiling, crate, red, blue, yellow], textures: [wallTex, floorTex] };
}

/** 숲 모드: 먼 산과 나무가 그려진 둘레, 큰 나무 무리, 잔디. 지금 전시 길은 z가 음수 쪽으로 뻗는다 */
export function buildForestSurround() {
  const group = new THREE.Group();
  group.name = 'forest-surround';
  const skyTex = paint(2048, 512, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 340);
    sky.addColorStop(0, '#8cc7e8'); sky.addColorStop(0.7, '#d9ecd9'); sky.addColorStop(1, '#fbe6c4');
    g.fillStyle = sky; g.fillRect(0, 0, 2048, 512);
    const hills = (base: number, amp: number, step: number, color: string, seed: number) => {
      g.fillStyle = color; g.beginPath(); g.moveTo(0, 512);
      for (let x = 0; x <= 2048; x += 8) g.lineTo(x, base + Math.sin((x + seed) / step) * amp + Math.sin((x + seed) / (step * 0.37)) * amp * 0.3);
      g.lineTo(2048, 512); g.fill();
    };
    hills(250, 34, 170, '#9dbfa8', 0);
    hills(300, 26, 120, '#6f9f76', 500);
    hills(345, 18, 90, '#4f8357', 900);
    // 가까운 나무 줄
    g.fillStyle = '#35643f';
    for (let x = 0; x < 2048; x += 22) { const h = 40 + ((x * 7) % 34); g.beginPath(); g.moveTo(x - 16, 400); g.lineTo(x, 400 - h); g.lineTo(x + 16, 400); g.fill(); }
    g.fillStyle = '#3f6d43'; g.fillRect(0, 398, 2048, 114);
  });
  skyTex.wrapS = THREE.RepeatWrapping;
  const round = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
  const surround = new THREE.Mesh(new THREE.CylinderGeometry(190, 190, 110, 48, 1, true), round);
  surround.position.set(0, 44, -40);
  const top = new THREE.MeshBasicMaterial({ color: '#8cc7e8', side: THREE.BackSide, fog: false });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(190, 48), top);
  cap.rotation.x = -Math.PI / 2; cap.position.set(0, 99, -40);
  const grass = new THREE.MeshStandardMaterial({ color: '#6f9554', roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(190, 48), grass);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.6, -40);
  group.add(surround, cap, ground);

  // 전시 길 밖을 두르는 큰 나무. 휴대폰 부담을 줄이려고 한 번에 그린다
  const spots: [number, number, number][] = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2, wob = Math.sin(i * 12.9) * 0.5 + 0.5;
    spots.push([Math.cos(a) * (58 + wob * 26), -40 + Math.sin(a) * (92 + wob * 26), 0.8 + ((i * 7) % 5) * 0.14]);
  }
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }), leafMat = new THREE.MeshStandardMaterial({ color: '#2f6b3c', roughness: 0.9 }), leaf2Mat = new THREE.MeshStandardMaterial({ color: '#3f8048', roughness: 0.9 });
  const part = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, sy = 1) => {
    const mesh = new THREE.InstancedMesh(geo, m, spots.length), o = new THREE.Object3D();
    spots.forEach(([x, z, s], i) => { o.position.set(x, y * s, z); o.scale.set(s, s * sy, s); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.frustumCulled = false;
    group.add(mesh);
  };
  part(new THREE.CylinderGeometry(0.6, 0.9, 7, 8), trunkMat, 3.5);
  part(new THREE.ConeGeometry(5, 11, 10), leafMat, 11);
  part(new THREE.ConeGeometry(3.6, 8, 10), leaf2Mat, 16.5);
  return { group, materials: [round, top, grass, trunkMat, leafMat, leaf2Mat], textures: [skyTex] };
}
