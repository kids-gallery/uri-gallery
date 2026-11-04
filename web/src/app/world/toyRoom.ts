// 장난감 모드 배경(마스터플랜 3-3 #137). "큰 테이블 위 전시섬" 설정에 맞게 아이 방과 큰 장난감을 두른다.
// 걷는 길 밖에만 두고 충돌은 넣지 않는다. 벽은 안개와 빛의 영향을 받지 않아 어느 시간대에도 방으로 보인다.
import * as THREE from 'three';

export interface TableBounds { minX: number; maxX: number; minZ: number; maxZ: number }
const FLOOR_Y = -7, ROOM_MARGIN = 55, ROOM_H = 80;

export function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 벽 한 면: 줄무늬 벽지, 큰 창문과 구름, 아이 그림 액자 둘, 아래쪽 판벽과 책장 */
function wallTexture() {
  return paint(1024, 410, (g) => {
    g.fillStyle = '#fff2d4'; g.fillRect(0, 0, 1024, 410);
    g.fillStyle = 'rgba(255,190,150,.28)'; for (let x = 0; x < 1024; x += 64) g.fillRect(x, 0, 32, 410);
    g.fillStyle = '#ffd9a8'; g.fillRect(0, 300, 1024, 110);
    g.fillStyle = '#e9b27a'; g.fillRect(0, 296, 1024, 8);
    // 창문
    const sky = g.createLinearGradient(0, 40, 0, 270); sky.addColorStop(0, '#6fc3ff'); sky.addColorStop(1, '#d6f0ff');
    g.fillStyle = '#ffffff'; g.fillRect(372, 28, 280, 250);
    g.fillStyle = sky; g.fillRect(386, 42, 252, 222);
    g.fillStyle = '#ffe066'; g.beginPath(); g.arc(590, 92, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; for (const [x, y, r] of [[440, 130, 22], [468, 120, 28], [498, 132, 20], [530, 200, 18], [556, 192, 24], [584, 204, 16]] as const) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff'; g.fillRect(506, 42, 12, 222); g.fillRect(386, 148, 252, 12);
    // 아이 그림 액자
    g.fillStyle = '#c98f58'; g.fillRect(96, 70, 190, 150); g.fillRect(738, 70, 190, 150);
    g.fillStyle = '#fffdf5'; g.fillRect(108, 82, 166, 126); g.fillRect(750, 82, 166, 126);
    g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(148, 150); g.lineTo(191, 104); g.lineTo(234, 150); g.fill();
    g.fillStyle = '#3a86ff'; g.fillRect(160, 150, 62, 44);
    g.fillStyle = '#3fb950'; g.fillRect(760, 176, 146, 22);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(832, 132, 28, 0, Math.PI * 2); g.fill();
    // 판벽 앞 책장
    const books = ['#e63946', '#3a86ff', '#ffd23f', '#3fb950', '#9b5de5', '#ff9f1c'];
    g.fillStyle = '#b57a45'; g.fillRect(90, 318, 240, 80); g.fillRect(694, 318, 240, 80);
    for (const left of [100, 704]) for (let i = 0; i < 12; i++) { g.fillStyle = books[i % books.length]!; g.fillRect(left + i * 18, 330 + (i % 3) * 4, 14, 58 - (i % 3) * 4); }
  });
}
function floorTexture() {
  return paint(512, 512, (g) => {
    g.fillStyle = '#c99868'; g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(90,55,25,.28)'; for (let y = 0; y < 512; y += 64) g.fillRect(0, y, 512, 3);
    g.fillStyle = 'rgba(255,230,190,.12)'; for (let y = 16; y < 512; y += 128) g.fillRect(0, y, 512, 20);
  });
}

export function buildToyRoom(t: TableBounds) {
  const group = new THREE.Group();
  group.name = 'toy-room';
  const wallTex = wallTexture(), floorTex = floorTexture();
  const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, ...o });
  const wall = basic({ map: wallTex }), floor = basic({ map: floorTex }), ceiling = basic({ color: '#fffaf0' });
  const color = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0 });
  const red = color('#e63946'), yellow = color('#ffd23f'), blue = color('#3a86ff'), green = color('#3fb950'), orange = color('#ff9f1c'), purple = color('#9b5de5'), white = color('#fffaf0'), bear = color('#c98f58');
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); group.add(o); return o; };

  // 방: 테이블 둘레로 벽을 두르고, 다리가 닿는 높이에 바닥을 둔다
  const minX = t.minX - ROOM_MARGIN, maxX = t.maxX + ROOM_MARGIN, minZ = t.minZ - ROOM_MARGIN, maxZ = t.maxZ + ROOM_MARGIN;
  const room = new THREE.BoxGeometry(maxX - minX, ROOM_H, maxZ - minZ);
  add(room, [wall, wall, ceiling, floor, wall, wall] as unknown as THREE.Material, (minX + maxX) / 2, FLOOR_Y + ROOM_H / 2, (minZ + maxZ) / 2);

  const cx = (t.minX + t.maxX) / 2, back = t.minZ + 8, front = t.maxZ - 8;
  // 쌓은 블록(왼쪽 뒤)
  const size = 5.5;
  [[0, 0, red], [size + 0.3, 0, blue], [size / 2, 1, yellow], [0, 0, green, 1], [size / 2, 2, orange]].forEach((b) => {
    const [dx, row, m, far] = b as [number, number, THREE.Material, number?];
    add(new THREE.BoxGeometry(size, size, size), m, t.minX + 7 + dx, size / 2 + row * size, back + (far ? size + 0.3 : 0));
  });
  // 끼우는 고리(오른쪽 뒤)
  [[orange, 6.2], [yellow, 5.2], [green, 4.2], [blue, 3.2], [purple, 2.3]].forEach((r, i) => {
    const [m, radius] = r as [THREE.Material, number];
    add(new THREE.TorusGeometry(radius, 1.25, 12, 28), m, t.maxX - 9, 1.25 + i * 2.3, back).rotation.x = Math.PI / 2;
  });
  add(new THREE.CylinderGeometry(0.7, 0.7, 13, 12), white, t.maxX - 9, 6.5, back);
  // 크레용 세 자루(가운데 뒤)
  [[red, -5, -0.08], [blue, 0, 0.04], [green, 5, 0.1]].forEach((c) => {
    const [m, dx, roll] = c as [THREE.Material, number, number];
    const crayon = new THREE.Group();
    crayon.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 15, 16), m));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.2, 16), m); tip.position.y = 9.1; crayon.add(tip);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.56, 7, 16), white); band.position.y = -2; crayon.add(band);
    crayon.position.set(cx + dx, 7.5, t.minZ + 5);
    crayon.rotation.z = roll;
    group.add(crayon);
  });
  // 공(왼쪽 앞)
  add(new THREE.SphereGeometry(5, 24, 16), red, t.minX + 6, 5, front);
  add(new THREE.TorusGeometry(5, 0.45, 8, 32), white, t.minX + 6, 5, front).rotation.y = 0.6;
  // 곰 인형(오른쪽 앞)
  const bx = t.maxX - 6, bz = front;
  add(new THREE.SphereGeometry(3.8, 20, 14), bear, bx, 3.6, bz);
  add(new THREE.SphereGeometry(2.8, 20, 14), bear, bx, 8.6, bz);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(1.1, 12, 10), bear, bx + s * 2.2, 11, bz);
    add(new THREE.SphereGeometry(1.3, 12, 10), bear, bx + s * 3.8, 4.4, bz + 0.6);
    add(new THREE.SphereGeometry(1.4, 12, 10), bear, bx + s * 2.2, 1.2, bz + 1.6);
  }
  // 방바닥의 큰 블록(테이블 양옆)
  [[t.minX - 24, 14, blue], [t.minX - 36, 10, yellow], [t.maxX + 24, 14, purple], [t.maxX + 36, 10, red]].forEach((b, i) => {
    const [x, s, m] = b as [number, number, THREE.Material];
    add(new THREE.BoxGeometry(s, s, s), m, x, FLOOR_Y + s / 2, (t.minZ + t.maxZ) / 2 + (i % 2 ? 22 : -12)).rotation.y = 0.4 + i * 0.5;
  });
  return { group, materials: [wall, floor, ceiling, red, yellow, blue, green, orange, purple, white, bear], textures: [wallTex, floorTex] };
}
