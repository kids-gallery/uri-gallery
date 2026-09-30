// 아이 미술관 배치(D40, SD_02 §17-13 B) — 순수 함수. 화면(Scene.vue)은 이 결과를 CSS 3D 면으로 세우기만 한다.
// 좌표: 미터. x = 오른쪽 +, z = 입구에서 안쪽 +, y = 바닥에서 높이. CSS는 1m = 100px, 눈높이 EYE가 화면 가운데.
// 평면도: 입구(z=0) → 로비(동상) → 중앙 홀(폭 8m, 기둥 · 천창) → 끝벽 벽화. 방(6×6m, 층고 5m)은 홀 양옆에 번갈아(1 왼쪽 · 2 오른쪽 · 3 왼쪽 …).
// 방 = 나이 구역(최소 2 · 최대 8, 넘치면 오래된 구역을 마지막 방에 묶음), 나이 미정은 1번 방. 방문자는 "전시실 N"만.
import { m3 } from './copy';

// ---------- 입력(정규화된 전시) ----------
export type ItemKind = 'animated' | 'relief' | 'frame' | 'sculpture';
export interface MuseumItem {
  id: string;
  kind: ItemKind;
  title: string | null;
  /** 벽 · 진열대에 보일 멈춘 그림 */
  imageUrl: string | null;
  auxUrl?: string | null;
  /** 움직이는 그림(액자 안 재생 · 크게 보기) */
  videoUrl?: string | null;
  caption?: string | null;
}
export interface MuseumGroup {
  label: string;
  /** 나이 구역(가족만). null = 나이 미정 → 1번 방. 방문자는 싣지 않는다 */
  age?: number | null;
  items: MuseumItem[];
}
export interface MuseumInput {
  childAlias: string;
  character?: string | null;
  color?: string | null;
  museumStyle?: string | null;
  visitor: boolean;
  groups: MuseumGroup[];
}

// ---------- 출력 ----------
export interface Vec { x: number; z: number }
export interface Pose { x: number; z: number; yaw: number }
export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** 장식 면(바닥 · 벽 · 천장 · 기둥 · 글자판). w · h · 위치는 미터, 회전은 도 */
export interface Plane { key: string; cls: string; x: number; y: number; z: number; w: number; h: number; ry: number; rx: number; text?: string }
export interface FrameSpot { key: string; item: MuseumItem; room: number; x: number; y: number; z: number; ry: number; w: number; h: number; normal: Vec; pose: Pose }
export interface PedestalSpot { key: string; room: number; x: number; z: number; item: MuseumItem | null; pose: Pose; planes: Plane[] }
export interface StatueSpot { key: string; room: number; x: number; z: number; kind: 'character' | 'art' | 'plant'; item: MuseumItem | null }
export interface MuralSpot { key: string; x: number; y: number; z: number; ry: number; w: number; h: number; big: boolean; seed: number }
export interface Room {
  index: number; no: number; label: string; side: -1 | 1; rect: Rect; center: Vec;
  door: { z: number; hall: Vec; inside: Vec }; entry: Pose; count: number; hidden: number;
  frames: FrameSpot[]; pedestal: PedestalSpot; statues: StatueSpot[];
}
export interface MuseumLayout {
  alias: string; visitor: boolean; color: string;
  rooms: Room[]; frames: FrameSpot[]; pedestals: PedestalSpot[]; statues: StatueSpot[]; murals: MuralSpot[]; planes: Plane[];
  lobby: Rect; hall: Rect; walkable: Rect[]; blockers: Rect[]; bounds: Rect;
  start: Pose; hallEntry: Pose; zEnd: number;
}

// ---------- 치수 ----------
export const EYE = 1.55; // D41 hall3d와 같은 눈높이
export const HALL_HALF = 4;
export const ROOM = 6;
export const ROOM_H = 5;
export const HALL_H = 6;
export const LOBBY_D = 6;
export const END_PAD = 2;
export const DOOR_W = 2;
export const DOOR_H = 3;
export const MIN_ROOMS = 2;
export const MAX_ROOMS = 8;
export const PER_WALL = 3;
const MARGIN = 0.4;
const FRAME_W = 1.2;
const FRAME_H = 0.95;
const FRAME_Y = 1.65;
const VIEW_D = 2.1; // 액자 앞 서는 거리(가까움 2.5m 안)

/** 캐릭터 색 → 벽화 물감(연하게). 목록 밖이면 해바라기 */
export const TINT: Record<string, string> = {
  sunflower: '#FFC93C', peach: '#FF9E80', sky: '#6EC6FF', leaf: '#7ED67A', lavender: '#B89DF6', cloud: '#C8CBDA',
};

const r2 = (n: number) => Math.round(n * 1000) / 1000;
/** 바라보는 방향(dx, dz)의 yaw(도). 앞 = (−sin yaw, cos yaw) */
export const yawOf = (dx: number, dz: number) => r2((Math.atan2(-dx, dz) * 180) / Math.PI);

/** 면 → CSS transform(1m = 100px, 눈높이가 원점) */
export function planeTf(p: { x: number; y: number; z: number; ry?: number; rx?: number }): string {
  let s = `translate3d(${r2(p.x * 100)}px,${r2((EYE - p.y) * 100)}px,${r2(-p.z * 100)}px)`;
  if (p.ry) s += ` rotateY(${p.ry}deg)`;
  if (p.rx) s += ` rotateX(${p.rx}deg)`;
  return s;
}
export function planeStyle(p: { x: number; y: number; z: number; w: number; h: number; ry?: number; rx?: number }): Record<string, string> {
  const w = r2(p.w * 100); const h = r2(p.h * 100);
  return { width: `${w}px`, height: `${h}px`, margin: `${-h / 2}px 0 0 ${-w / 2}px`, transform: planeTf(p) };
}

// ---------- 방 나누기 ----------
interface RoomSeed { label: string; items: MuseumItem[] }
function roomSeeds(input: MuseumInput): RoomSeed[] {
  let groups = input.groups.filter((g) => g.items.length);
  // 나이 미정은 1번 방(§17-13 B) — 받은 순서는 그대로 두고 앞으로만 옮긴다
  const none = groups.filter((g) => g.age === null);
  if (none.length) groups = [...none, ...groups.filter((g) => g.age !== null)];
  let seeds: RoomSeed[] = groups.map((g) => ({ label: g.label, items: [...g.items] }));
  if (groups.length > MAX_ROOMS) {
    const rest = groups.slice(MAX_ROOMS - 1);
    const ages = rest.map((g) => g.age).filter((a): a is number => typeof a === 'number');
    const label = ages.length === rest.length ? m3.mergedAges(Math.min(...ages), Math.max(...ages)) : m3.mergedMore(rest[0]!.label);
    seeds = [...seeds.slice(0, MAX_ROOMS - 1), { label, items: rest.flatMap((g) => g.items) }];
  }
  while (seeds.length < MIN_ROOMS) seeds.push({ label: m3.emptyRoom, items: [] });
  if (input.visitor) seeds = seeds.map((s, i) => ({ ...s, label: m3.visitRoom(i + 1) }));
  return seeds;
}

const isSolid = (k: ItemKind) => k === 'relief' || k === 'sculpture';

// ---------- 배치 ----------
export function buildMuseumLayout(input: MuseumInput): MuseumLayout {
  const seeds = roomSeeds(input);
  const rows = Math.ceil(seeds.length / 2);
  const zRooms0 = LOBBY_D;
  const zEnd = zRooms0 + rows * ROOM + END_PAD;
  const planes: Plane[] = [];
  const P = (key: string, cls: string, o: Omit<Plane, 'key' | 'cls' | 'ry' | 'rx'> & { ry?: number; rx?: number }) =>
    planes.push({ key, cls, ry: 0, rx: 0, ...o });

  // 로비 · 홀: 바닥 · 천장 · 입구벽 · 끝벽
  P('floor-lobby', 'floor lobby', { x: 0, y: 0, z: LOBBY_D / 2, w: HALL_HALF * 2, h: LOBBY_D, rx: 90 });
  P('floor-hall', 'floor hall', { x: 0, y: 0, z: (LOBBY_D + zEnd) / 2, w: HALL_HALF * 2, h: zEnd - LOBBY_D, rx: 90 });
  P('ceil-lobby', 'ceil sky', { x: 0, y: HALL_H, z: LOBBY_D / 2, w: HALL_HALF * 2, h: LOBBY_D, rx: -90 });
  P('ceil-hall', 'ceil sky', { x: 0, y: HALL_H, z: (LOBBY_D + zEnd) / 2, w: HALL_HALF * 2, h: zEnd - LOBBY_D, rx: -90 });
  P('wall-entry', 'wall entry', { x: 0, y: HALL_H / 2, z: 0, w: HALL_HALF * 2, h: HALL_H, ry: 180 });
  P('wall-end', 'wall', { x: 0, y: HALL_H / 2, z: zEnd, w: HALL_HALF * 2, h: HALL_H });

  const rooms: Room[] = [];
  const frames: FrameSpot[] = [];
  const pedestals: PedestalSpot[] = [];
  const statues: StatueSpot[] = [];
  const murals: MuralSpot[] = [];
  const walkable: Rect[] = [];
  const blockers: Rect[] = [];

  seeds.forEach((seed, index) => {
    const side: -1 | 1 = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const z0 = zRooms0 + row * ROOM; const z1 = z0 + ROOM; const zc = z0 + ROOM / 2;
    const xin = side * HALL_HALF; const xout = side * (HALL_HALF + ROOM); const xc = side * (HALL_HALF + ROOM / 2);
    const rect: Rect = { x0: Math.min(xin, xout), x1: Math.max(xin, xout), z0, z1 };
    const facingHall = -side * 90; // 홀 쪽을 보는 면(왼쪽 방 먼 벽 = +x)
    const k = `r${index}`;

    P(`${k}-floor`, 'floor room', { x: xc, y: 0, z: zc, w: ROOM, h: ROOM, rx: 90 });
    P(`${k}-ceil`, 'ceil sky room', { x: xc, y: ROOM_H, z: zc, w: ROOM, h: ROOM, rx: -90 });
    P(`${k}-far`, 'wall room', { x: xout, y: ROOM_H / 2, z: zc, w: ROOM, h: ROOM_H, ry: facingHall });
    P(`${k}-label`, 'label', { x: side * (HALL_HALF - 0.02), y: DOOR_H + 0.45, z: zc, w: 2.6, h: 0.5, ry: facingHall, text: seed.label });
    // 문 양옆 기둥(홀 쪽) — 보이는 세 면
    for (const dz of [-1.6, 1.6]) {
      const cz = zc + dz; const cx = side * 3.4; const c = `${k}-col${dz < 0 ? 'a' : 'b'}`;
      P(`${c}-f`, 'col', { x: cx - side * 0.25, y: HALL_H / 2, z: cz, w: 0.5, h: HALL_H, ry: facingHall });
      P(`${c}-n`, 'col side', { x: cx, y: HALL_H / 2, z: cz - 0.25, w: 0.5, h: HALL_H, ry: 0 });
      P(`${c}-s`, 'col side', { x: cx, y: HALL_H / 2, z: cz + 0.25, w: 0.5, h: HALL_H, ry: 180 });
    }

    // 작품 나누기: 진열대 1(입체 첫 점) · 벽 3면 × 3점
    const solid = seed.items.find((it) => isSolid(it.kind)) ?? null;
    const wallItems = seed.items.filter((it) => it !== solid);
    const slots: { x: number; z: number; ry: number; normal: Vec }[] = [];
    const along = [0, -1.9, 1.9];
    for (const d of along) slots.push({ x: side * (HALL_HALF + ROOM - 0.03), z: zc + d, ry: facingHall, normal: { x: -side, z: 0 } }); // 먼 벽
    for (const d of along) slots.push({ x: xc + d, z: z0 + 0.03, ry: 180, normal: { x: 0, z: 1 } }); // 앞 벽(입구 쪽)
    for (const d of along) slots.push({ x: xc + d, z: z1 - 0.03, ry: 0, normal: { x: 0, z: -1 } }); // 뒤 벽
    const hung = wallItems.slice(0, PER_WALL * 3);
    const roomFrames: FrameSpot[] = hung.map((item, i) => {
      const s = slots[i]!;
      const px = s.x + s.normal.x * VIEW_D; const pz = s.z + s.normal.z * VIEW_D;
      return { key: `${k}-f${i}`, item, room: index, x: s.x, y: FRAME_Y, z: s.z, ry: s.ry, w: FRAME_W, h: FRAME_H, normal: s.normal,
        pose: { x: r2(px), z: r2(pz), yaw: yawOf(-s.normal.x, -s.normal.z) } };
    });

    // 진열대(받침 + 유리 상자) — 문 쪽에서 본다
    const pp: Plane[] = [];
    const box = (pre: string, cls: string, half: number, yb: number, h: number, top: boolean) => {
      pp.push({ key: `${pre}-e`, cls, x: xc + half, y: yb + h / 2, z: zc, w: half * 2, h, ry: 90, rx: 0 });
      pp.push({ key: `${pre}-w`, cls, x: xc - half, y: yb + h / 2, z: zc, w: half * 2, h, ry: -90, rx: 0 });
      pp.push({ key: `${pre}-n`, cls, x: xc, y: yb + h / 2, z: zc - half, w: half * 2, h, ry: 0, rx: 0 });
      pp.push({ key: `${pre}-s`, cls, x: xc, y: yb + h / 2, z: zc + half, w: half * 2, h, ry: 180, rx: 0 });
      if (top) pp.push({ key: `${pre}-t`, cls: `${cls} top`, x: xc, y: yb + h, z: zc, w: half * 2, h: half * 2, ry: 0, rx: 90 });
    };
    box(`${k}-plinth`, 'plinth', 0.45, 0, 0.9, true);
    if (solid) box(`${k}-glass`, 'glass', 0.4, 0.9, 0.9, false);
    else pp.push({ key: `${k}-ped-note`, cls: 'note', x: xc - side * 0.46, y: 0.55, z: zc, w: 0.86, h: 0.5, ry: facingHall, rx: 0, text: m3.pedestalEmpty });
    const pedestal: PedestalSpot = { key: `${k}-ped`, room: index, x: xc, z: zc, item: solid, planes: pp,
      pose: { x: r2(xc - side * 1.7), z: zc, yaw: yawOf(side, 0) } };
    blockers.push({ x0: xc - 0.6, x1: xc + 0.6, z0: zc - 0.6, z1: zc + 0.6 });

    // 문 양옆 동상 자리(방 안) — 첫 작품 · 둘째 작품의 작은 조각상, 없으면 화분
    const pick = [seed.items[0] ?? null, seed.items[1] ?? null];
    const roomStatues: StatueSpot[] = [-1.75, 1.75].map((dz, i) => {
      const it = pick[i] && (pick[i]!.imageUrl) ? pick[i]! : null;
      return { key: `${k}-st${i}`, room: index, x: side * (HALL_HALF + 0.75), z: zc + dz, kind: it ? 'art' : 'plant', item: it };
    });
    for (const s of roomStatues) blockers.push({ x0: s.x - 0.35, x1: s.x + 0.35, z0: s.z - 0.35, z1: s.z + 0.35 });

    const door = { z: zc, hall: { x: side * 3.0, z: zc }, inside: { x: side * (HALL_HALF + 1.2), z: zc } };
    const room: Room = {
      index, no: index + 1, label: seed.label, side, rect, center: { x: xc, z: zc }, door,
      entry: { x: side * (HALL_HALF + 0.3), z: zc, yaw: yawOf(side, 0) }, // 문턱에서 방 안을 본다
      count: seed.items.length, hidden: wallItems.length - hung.length,
      frames: roomFrames, pedestal, statues: roomStatues,
    };
    rooms.push(room); frames.push(...roomFrames); pedestals.push(pedestal); statues.push(...roomStatues);
    walkable.push({ x0: rect.x0 + MARGIN, x1: rect.x1 - MARGIN, z0: z0 + MARGIN, z1: z1 - MARGIN });
    walkable.push({ x0: side * HALL_HALF - 0.8, x1: side * HALL_HALF + 0.8, z0: zc - DOOR_W / 2 + MARGIN, z1: zc + DOOR_W / 2 - MARGIN });
  });

  // 홀 옆벽: 로비 구간 · 방 줄마다(문 있으면 세 조각) · 끝 구간. 방 사이 벽(옆벽)은 경계마다 한 장(양쪽 방이 같이 쓴다)
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? 'L' : 'R'; const x = side * HALL_HALF; const ry = -side * 90;
    P(`hw${s}-lobby`, 'wall', { x, y: HALL_H / 2, z: LOBBY_D / 2, w: LOBBY_D, h: HALL_H, ry });
    for (let row = 0; row < rows; row++) {
      const z0 = zRooms0 + row * ROOM; const zc = z0 + ROOM / 2;
      const has = rooms.some((r) => r.side === side && Math.floor(r.index / 2) === row);
      if (!has) { P(`hw${s}-${row}`, 'wall', { x, y: HALL_H / 2, z: zc, w: ROOM, h: HALL_H, ry }); continue; }
      const seg = (ROOM - DOOR_W) / 2;
      P(`hw${s}-${row}a`, 'wall', { x, y: HALL_H / 2, z: z0 + seg / 2, w: seg, h: HALL_H, ry });
      P(`hw${s}-${row}b`, 'wall', { x, y: HALL_H / 2, z: zc + DOOR_W / 2 + seg / 2, w: seg, h: HALL_H, ry });
      P(`hw${s}-${row}c`, 'wall lintel', { x, y: (DOOR_H + HALL_H) / 2, z: zc, w: DOOR_W, h: HALL_H - DOOR_H, ry });
    }
    P(`hw${s}-end`, 'wall', { x, y: HALL_H / 2, z: zRooms0 + rows * ROOM + END_PAD / 2, w: END_PAD, h: HALL_H, ry });
    const mine = rooms.filter((r) => r.side === side);
    const count = mine.length;
    for (let b = 0; b <= count; b++) {
      const z = zRooms0 + b * ROOM;
      P(`rw${s}-${b}`, 'wall room', { x: side * (HALL_HALF + ROOM / 2), y: ROOM_H / 2, z, w: ROOM, h: ROOM_H });
      // 방 사이 홀 벽에 작은 벽화(양쪽에 방이 있는 경계만)
      if (b > 0 && b < count) murals.push({ key: `mu${s}-${b}`, x: side * (HALL_HALF - 0.02), y: 2.3, z, ry, w: 1.6, h: 1.1, big: false, seed: b + (side < 0 ? 0 : 7) });
    }
  }
  murals.push({ key: 'mu-end', x: 0, y: 3, z: zEnd - 0.02, ry: 0, w: 7.2, h: 4.2, big: true, seed: 0 });

  // 로비 가운데 캐릭터 동상(항상)
  statues.push({ key: 'lobby-statue', room: -1, x: 0, z: 3, kind: 'character', item: null });
  blockers.push({ x0: -0.7, x1: 0.7, z0: 2.3, z1: 3.7 });

  const lobby: Rect = { x0: -HALL_HALF, x1: HALL_HALF, z0: 0, z1: LOBBY_D };
  const hall: Rect = { x0: -HALL_HALF, x1: HALL_HALF, z0: LOBBY_D, z1: zEnd };
  walkable.unshift({ x0: -HALL_HALF + MARGIN, x1: HALL_HALF - MARGIN, z0: MARGIN, z1: zEnd - MARGIN });
  return {
    alias: input.childAlias, visitor: input.visitor, color: TINT[input.color ?? ''] ?? TINT.sunflower!,
    rooms, frames, pedestals, statues, murals, planes, lobby, hall, walkable, blockers,
    bounds: { x0: -(HALL_HALF + ROOM), x1: HALL_HALF + ROOM, z0: 0, z1: zEnd },
    start: { x: 0, z: 0.9, yaw: 0 }, hallEntry: { x: 0, z: LOBBY_D + 0.6, yaw: 0 }, zEnd,
  };
}

// ---------- 움직임 도우미(순수) ----------
const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
export function canStand(L: Pick<MuseumLayout, 'walkable' | 'blockers'>, x: number, z: number): boolean {
  return L.walkable.some((r) => inRect(r, x, z)) && !L.blockers.some((r) => inRect(r, x, z));
}
/** 벽 충돌: 갈 수 있으면 가고, 막히면 축마다 미끄러진다 */
export function clampMove(L: Pick<MuseumLayout, 'walkable' | 'blockers'>, from: Vec, to: Vec): Vec {
  if (canStand(L, to.x, to.z)) return { x: to.x, z: to.z };
  if (canStand(L, to.x, from.z)) return { x: to.x, z: from.z };
  if (canStand(L, from.x, to.z)) return { x: from.x, z: to.z };
  return { x: from.x, z: from.z };
}
/** 지금 있는 곳: 방 번호(0부터) · 'hall' · 'lobby' */
export function areaOf(L: Pick<MuseumLayout, 'rooms' | 'lobby'>, p: Vec): number | 'hall' | 'lobby' {
  const r = L.rooms.find((x) => inRect(x.rect, p.x, p.z) && Math.abs(p.x) > HALL_HALF);
  if (r) return r.index;
  return inRect(L.lobby, p.x, p.z) ? 'lobby' : 'hall';
}
/** 걸어갈 길: 방을 나설 때 · 들어갈 때 문을 지난다(마지막 점 = 목표) */
export function pathTo(L: Pick<MuseumLayout, 'rooms' | 'lobby'>, from: Vec, to: Vec): Vec[] {
  const a = areaOf(L, from); const b = areaOf(L, to);
  const out: Vec[] = [];
  if (typeof a === 'number' && a !== b) { const r = L.rooms[a]!; out.push(r.door.inside, r.door.hall); }
  if (typeof b === 'number' && a !== b) { const r = L.rooms[b]!; out.push(r.door.hall, r.door.inside); }
  out.push({ x: to.x, z: to.z });
  return out;
}

/** 화면 한 점 → 바닥 위 점(미터). sx · sy = 화면 가운데 기준 px, P = CSS perspective. 바닥을 안 보면 null */
export function screenToFloor(cam: { x: number; z: number; yaw: number; pitch: number }, sx: number, sy: number, P: number): Vec | null {
  const p = (cam.pitch * Math.PI) / 180; const y = (cam.yaw * Math.PI) / 180;
  // 카메라 공간 광선(CSS: y 아래 +, 앞 = −z) → Rx(−pitch) → Ry(yaw)
  const v0 = { x: sx, y: sy, z: -P };
  const v1 = { x: v0.x, y: Math.cos(-p) * v0.y - Math.sin(-p) * v0.z, z: Math.sin(-p) * v0.y + Math.cos(-p) * v0.z };
  const v2 = { x: Math.cos(y) * v1.x + Math.sin(y) * v1.z, y: v1.y, z: -Math.sin(y) * v1.x + Math.cos(y) * v1.z };
  if (v2.y <= 1e-6) return null;
  const t = (EYE * 100) / v2.y;
  return { x: cam.x + (v2.x * t) / 100, z: cam.z - (v2.z * t) / 100 };
}

/** 가까운지(크게 보기 바로 열기 · E 알림): D41 hall3d와 같이 2.5m 안 · 바라봄 45° 안 */
export const NEAR_M = 2.5;
export const FACE_DEG = 45;
export function isNear(cam: Vec, obj: Vec): boolean { return Math.hypot(cam.x - obj.x, cam.z - obj.z) <= NEAR_M + 1e-6; }
/** 바라보는 쪽에서 가장 가까운 대상(없으면 null) */
export function nearestTarget<T extends Vec>(cam: Pose, list: T[]): T | null {
  const y = (cam.yaw * Math.PI) / 180; const fx = -Math.sin(y); const fz = Math.cos(y); const lim = Math.cos((FACE_DEG * Math.PI) / 180);
  let best: T | null = null; let bd = Infinity;
  for (const t of list) {
    const dx = t.x - cam.x; const dz = t.z - cam.z; const d = Math.hypot(dx, dz);
    if (d > NEAR_M || d < 1e-6 || (dx * fx + dz * fz) / d < lim) continue;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** 대략의 3D 요소 수(성능 기준 ~400) — 면 + 액자 2 + 진열대 면 + 그림 + 동상 2 + 벽화 */
export function domEstimate(L: MuseumLayout): number {
  return L.planes.length + L.frames.length * 2 + L.pedestals.reduce((n, p) => n + p.planes.length + (p.item ? 2 : 0), 0)
    + L.statues.length * 2 + L.murals.length + 20;
}
