// Adapted from ThreeMuseum src/player/navigation.js, f247052675d80ff0188709cab5facb4035bfaa49.
// Copyright (c) 2026 ThreeMuseum contributors. MIT: /licenses/ThreeMuseum.txt.
// Changes: TypeScript, configurable radius, flat exhibition floors and bounded floor predicate.
export interface Solid { min: [number, number, number]; max: [number, number, number] }
export interface Point { x: number; z: number }
export function intersectsSolid(x: number, y: number, z: number, b: Solid, radius = .42, height = 1.72) {
  if (y + .025 >= b.max[1] || y + height <= b.min[1] + .015) return false;
  const cx = Math.min(b.max[0], Math.max(b.min[0], x));
  const cz = Math.min(b.max[2], Math.max(b.min[2], z));
  return (x - cx) ** 2 + (z - cz) ** 2 < radius * radius - 1e-9;
}
/** 앞이 막혔을 때 좌우로 찾는 거리(문틀 바깥쪽 2.075 - 지나가는 폭 1.305)와 후보 눈금, 그 자리에서 앞으로 트여야 하는 거리(문틀 두께 .55 + 몸 지름 .84), 비껴 주는 입력의 기울기 한도(약 14도. 30도로 하면 곡면 벽을 긁으며 떨린다). 설계서 2-1 문 드나들기 */
const SLIP_REACH = .8, SLIP_AHEAD = 1.4, SLIP_TILT = .25, SLIP_GRID = .09;
export class NavigationWorld {
  private grid = new Map<string, Solid[]>();
  constructor(readonly colliders: Solid[], private floor: (x: number, z: number) => boolean, readonly radius = .42) {
    for (const b of colliders) for (let x = Math.floor((b.min[0] - radius) / 4); x <= Math.floor((b.max[0] + radius) / 4); x++) {
      for (let z = Math.floor((b.min[2] - radius) / 4); z <= Math.floor((b.max[2] + radius) / 4); z++) {
        const key = `${x},${z}`, cell = this.grid.get(key) ?? []; cell.push(b); this.grid.set(key, cell);
      }
    }
  }
  canStand(x: number, z: number) {
    return Number.isFinite(x) && Number.isFinite(z) && this.floor(x, z) &&
      !(this.grid.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []).some(b => intersectsSolid(x, 0, z, b, this.radius));
  }
  move(state: Point, dx: number, dz: number) {
    if (![state.x, state.z, dx, dz].every(Number.isFinite)) throw new TypeError('Movement coordinates must be finite.');
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .09)); dx /= steps; dz /= steps;
    for (let i = 0; i < steps; i++) {
      const movedX = this.canStand(state.x + dx, state.z); if (movedX) state.x += dx;
      const movedZ = this.canStand(state.x, state.z + dz); if (movedZ) state.z += dz;
      if (!movedX && Math.abs(dz) <= Math.abs(dx) * SLIP_TILT) this.slip(state, dx, 0);
      else if (!movedZ && Math.abs(dx) <= Math.abs(dz) * SLIP_TILT) this.slip(state, 0, dz);
    }
    return state;
  }
  // 앞이 막혔을 때 옆으로 비키면 문 두께만큼 앞으로 나갈 수 있는 가까운 자리로 다가간다. 옆길이 막힌 쪽은 보지 않는다.
  // 후보를 고정 눈금에 두어 다가가는 동안 답이 바뀌지 않게 하고, 찾은 자리를 넘지 않아 떨리지 않는다
  private slip(state: Point, dx: number, dz: number) {
    const ax = Math.sign(dx), az = Math.sign(dz), now = dx ? state.z : state.x, base = Math.round(now / SLIP_GRID) * SLIP_GRID;
    const at = (c: number): Point => dx ? { x: state.x, z: c } : { x: c, z: state.z };
    const ahead = (p: Point) => { if (!this.canStand(p.x + dx, p.z + dz)) return false; for (let t = .2; t <= SLIP_AHEAD; t += .2) if (!this.canStand(p.x + ax * t, p.z + az * t)) return false; return true; };
    const sides = now >= base ? [1, -1] : [-1, 1], open = { 1: true, [-1]: true } as Record<number, boolean>;
    for (let k = 0; (k - 1) * SLIP_GRID <= SLIP_REACH; k++) for (const side of sides) {
      const c = base + side * k * SLIP_GRID, gap = Math.abs(c - now);
      if (gap < 1e-6 || gap > SLIP_REACH || Math.sign(c - now) !== side) continue;
      const p = at(c);
      open[side] = open[side]! && this.canStand(p.x, p.z);
      if (!open[side] || !ahead(p)) continue;
      const next = at(now + side * Math.min(Math.abs(dx || dz), gap));
      if (this.canStand(next.x, next.z)) { state.x = next.x; state.z = next.z; }
      return;
    }
  }
  clearLine(a: Point, b: Point) {
    const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / .25));
    for (let i = 0; i <= steps; i++) if (!this.canStand(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps)) return false;
    return true;
  }
  // A visibility graph over authored circulation nodes; no teleport fallback through a wall.
  route(from: Point, to: Point, nodes: Point[]): Point[] {
    if (!this.canStand(to.x, to.z)) return [];
    if (this.clearLine(from, to)) return [to];
    const pts = [from, ...nodes.filter(p => this.canStand(p.x, p.z)), to];
    const distance = pts.map(() => Infinity), prev = pts.map(() => -1), done = new Set<number>(); distance[0] = 0;
    for (let iteration = 0; iteration < pts.length; iteration++) {
      let a = -1; for (let i = 0; i < pts.length; i++) if (!done.has(i) && (a < 0 || distance[i]! < distance[a]!)) a = i;
      if (a < 0 || !Number.isFinite(distance[a]!)) break;
      if (a === pts.length - 1) { const route: Point[] = []; for (let k = a; k > 0; k = prev[k]!) route.unshift(pts[k]!); return route; }
      done.add(a);
      for (let b = 1; b < pts.length; b++) {
        if (done.has(b)) continue;
        const cost = distance[a]! + Math.hypot(pts[a]!.x - pts[b]!.x, pts[a]!.z - pts[b]!.z);
        if (cost < distance[b]! && this.clearLine(pts[a]!, pts[b]!)) { distance[b] = cost; prev[b] = a; }
      }
    }
    return [];
  }
}
