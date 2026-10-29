// 시작 화면과 시작 연출의 시간표·구도(3D미술관_재설계 §2-17). 엔진과 화면이 같은 값을 읽고, 단위 시험이 이 값을 확인한다.
// 좌표는 광장 건물의 문(Outdoor.doorOf)을 기준으로 계산한다. 공간 배치가 바뀌어도 문 위치만 넘기면 된다.

export interface Vec3 { x: number; y: number; z: number }

/** 누른 뒤 초. 움직임 줄이기가 꺼져 있을 때 */
export const START = {
  leave: 0.3, // 제목 묶음이 사라진다
  doorOpen: 0.8, // 문이 다 열린다
  approach: 1.4, // 시작 화면 구도에서 캐릭터 뒤 시점으로 다 섞인다
  wipeIn: 1.4, // 흰빛이 덮이기 시작한다
  swap: 1.75, // 흰빛이 다 덮였을 때 안쪽 장면으로 바꾼다
  wipeOut: 2.05, // 흰빛이 다 걷힌다
  arrive: 3.2, // 카메라가 도착 구도에 닿고 HUD가 나타나기 시작한다
  hudStep: 0.08, // HUD 묶음 사이 간격
  hudFade: 0.3, // HUD 묶음 하나가 나타나는 시간
} as const;

/** 움직임 줄이기, 건너뛰기에서 흰빛이 덮이고 걷히는 시간 */
export const QUICK = 0.15;

/** 바깥 다가가기: 문 앞 거리 → 문턱 거리(캐릭터 뒤 카메라) */
export const FOLLOW = { pitch: 0.3, far: 5.5, near: 2.4, pushFrom: 1.0 } as const;
/** 안으로: 거리를 늘린 게임 카메라에서 평소 거리로 */
export const INSIDE = { pitch: 0.34, far: 7.0 } as const;

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** 가속·감속(smoothstep) */
export const ease = (t: number) => { const k = clamp01(t); return k * k * (3 - 2 * k); };
/** 감속 */
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** 시작 연출 t초의 흰빛 불투명도(0~1) */
export function wipeAt(t: number): number {
  if (t <= START.wipeIn) return 0;
  if (t <= START.swap) return ease((t - START.wipeIn) / (START.swap - START.wipeIn));
  if (t <= START.wipeOut) return 1 - ease((t - START.swap) / (START.wipeOut - START.swap));
  return 0;
}

/** HUD 묶음 i가 t초에 보이는 정도(0~1) */
export function hudAt(t: number, i: number): number {
  return clamp01((t - START.arrive - i * START.hudStep) / START.hudFade);
}

/** 바깥 카메라가 문턱 쪽으로 다가가는 거리 */
export function followDistance(t: number): number {
  return FOLLOW.far + (FOLLOW.near - FOLLOW.far) * ease((t - FOLLOW.pushFrom) / (START.swap - FOLLOW.pushFrom));
}

/** 안쪽 카메라 거리·기울기: 늘린 거리에서 평소 거리로(감속) */
export function insideFraming(t: number, rest: { dist: number; pitch: number }) {
  const k = easeOut((t - START.swap) / (START.arrive - START.swap));
  return { dist: INSIDE.far + (rest.dist - INSIDE.far) * k, pitch: INSIDE.pitch + (rest.pitch - INSIDE.pitch) * k };
}

/** 시작 화면 구도. 넓은 화면은 제목이 왼쪽이라 건물을 오른쪽에, 세로 화면은 건물을 위쪽 절반에 둔다. drift는 초 */
export const TITLE = {
  wide: { azimuth: -24, elevation: 12, distance: 30, lookShift: { x: -6, y: -1.2 } },
  tall: { azimuth: -10, elevation: 14, distance: 36, lookShift: { x: 0, y: -2.6 } },
  driftDeg: 3,
  driftPeriod: 20,
} as const;

export function titleShot(facade: Vec3, aspect: number, drift: number): { pos: Vec3; look: Vec3 } {
  const c = aspect < 0.9 ? TITLE.tall : TITLE.wide;
  const az = ((c.azimuth + TITLE.driftDeg * Math.sin((2 * Math.PI * drift) / TITLE.driftPeriod)) * Math.PI) / 180;
  const el = (c.elevation * Math.PI) / 180;
  const pos = {
    x: facade.x + Math.sin(az) * Math.cos(el) * c.distance,
    y: facade.y + Math.sin(el) * c.distance,
    z: facade.z + Math.cos(az) * Math.cos(el) * c.distance,
  };
  return { pos, look: { x: facade.x + c.lookShift.x, y: facade.y + c.lookShift.y, z: facade.z } };
}

export const mix = (a: Vec3, b: Vec3, k: number): Vec3 => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
