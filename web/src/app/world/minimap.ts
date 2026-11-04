// 미니맵 계산과 그리기(마스터플랜 3-3 #137). 평면 값을 그대로 읽어 모드마다 따로 그리지 않는다.
import type { Floor } from './spatialLayout';

export interface MinimapData { floors: Floor[]; x: number; z: number; yaw: number; works: { x: number; z: number; making: boolean }[] }
export interface MapBounds { minX: number; maxX: number; minZ: number; maxZ: number }

/** 돌아간 길까지 담는 평면의 범위 */
export function mapBounds(floors: Floor[]): MapBounds {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const f of floors) {
    const c = Math.abs(Math.cos(f.yaw ?? 0)), s = Math.abs(Math.sin(f.yaw ?? 0));
    const hx = (f.w * c + f.d * s) / 2, hz = (f.w * s + f.d * c) / 2;
    b.minX = Math.min(b.minX, f.x - hx); b.maxX = Math.max(b.maxX, f.x + hx);
    b.minZ = Math.min(b.minZ, f.z - hz); b.maxZ = Math.max(b.maxZ, f.z + hz);
  }
  return b;
}

/** 평면 좌표를 화면 칸으로 옮긴다. 가로세로 비율을 지키고 가운데에 둔다. 위쪽이 안쪽(-z)이다 */
export function mapProject(b: MapBounds, size: number, pad = 6) {
  const w = Math.max(1, b.maxX - b.minX), d = Math.max(1, b.maxZ - b.minZ), scale = (size - pad * 2) / Math.max(w, d);
  const ox = (size - w * scale) / 2 - b.minX * scale, oz = (size - d * scale) / 2 - b.minZ * scale;
  return { scale, x: (x: number) => ox + x * scale, y: (z: number) => oz + z * scale };
}

export function drawMinimap(g: CanvasRenderingContext2D, size: number, d: MinimapData) {
  const p = mapProject(mapBounds(d.floors), size);
  g.clearRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,246,226,.82)';
  for (const f of d.floors) {
    g.save();
    g.translate(p.x(f.x), p.y(f.z));
    if (f.round) { g.beginPath(); g.ellipse(0, 0, f.w * p.scale / 2, f.d * p.scale / 2, 0, 0, Math.PI * 2); g.fill(); }
    else { g.rotate(-(f.yaw ?? 0)); g.fillRect(-f.w * p.scale / 2, -f.d * p.scale / 2, f.w * p.scale, f.d * p.scale); }
    g.restore();
  }
  for (const w of d.works) {
    const x = p.x(w.x), y = p.y(w.z);
    g.fillStyle = '#a0496b';
    if (w.making) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); }
    else g.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
  }
  // 내 위치와 바라보는 쪽
  g.save();
  g.translate(p.x(d.x), p.y(d.z));
  g.rotate(Math.PI - d.yaw);
  g.fillStyle = '#e0a526'; g.strokeStyle = '#3a2a1f'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, -6); g.lineTo(4.4, 4.4); g.lineTo(0, 2); g.lineTo(-4.4, 4.4); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
