// 3D미술관_재설계 §2-17 시작 연출: 흰빛은 장면을 바꾸는 순간에만 다 덮고, HUD는 한 번에 나타나지 않으며, 시작 화면 구도는 화면 비율에 맞춘다.
import { describe, expect, it } from 'vitest';
import { START, QUICK, FOLLOW, INSIDE, wipeAt, hudAt, followDistance, insideFraming, titleShot, ease, easeOut } from '@/app/world/startSequence';

describe('시작 연출 시간표', () => {
  it('정해진 순서로 이어진다', () => {
    expect(START.leave).toBeLessThan(START.approach);
    expect(START.doorOpen).toBeLessThan(START.swap);
    expect(START.wipeIn).toBeLessThan(START.swap);
    expect(START.swap).toBeLessThan(START.wipeOut);
    expect(START.wipeOut).toBeLessThan(START.arrive);
    expect(START.arrive + 2 * START.hudStep + START.hudFade).toBeLessThanOrEqual(4); // 끝나는 조건: 누른 뒤 4초 안에 HUD가 다 나타난다
    expect(QUICK).toBeLessThanOrEqual(0.15);
  });

  it('흰빛은 장면을 바꾸는 순간에만 1이고 앞뒤로 이어진다', () => {
    expect(wipeAt(0)).toBe(0);
    expect(wipeAt(START.wipeIn)).toBe(0);
    expect(wipeAt(START.swap)).toBe(1);
    expect(wipeAt(START.wipeOut)).toBe(0);
    expect(wipeAt(START.arrive)).toBe(0);
    // 0.01초 간격으로 훑으면 한 번에 0.2 넘게 바뀌지 않는다(한 프레임 사이 급변 없음)
    let prev = wipeAt(0), maxStep = 0, full = 0;
    for (let t = 0.01; t <= 4; t += 0.01) { const w = wipeAt(t); maxStep = Math.max(maxStep, Math.abs(w - prev)); prev = w; if (w > 0.999) full++; }
    expect(maxStep).toBeLessThan(0.2);
    expect(full).toBeLessThanOrEqual(2);
  });

  it('HUD 묶음은 차례로 0에서 1로 나타난다', () => {
    for (const i of [0, 1, 2]) {
      expect(hudAt(START.arrive + i * START.hudStep, i)).toBeCloseTo(0, 6);
      expect(hudAt(START.arrive + i * START.hudStep + START.hudFade, i)).toBeCloseTo(1, 6);
    }
    expect(hudAt(START.arrive + 0.15, 0)).toBeGreaterThan(hudAt(START.arrive + 0.15, 2));
  });

  it('카메라 거리는 문턱 쪽으로, 안에서는 평소 거리로 줄어든다', () => {
    expect(followDistance(0)).toBe(FOLLOW.far);
    expect(followDistance(START.swap)).toBeCloseTo(FOLLOW.near);
    const rest = { dist: 4.4, pitch: 0.22 };
    expect(insideFraming(START.swap, rest)).toEqual({ dist: INSIDE.far, pitch: INSIDE.pitch });
    const end = insideFraming(START.arrive, rest);
    expect(end.dist).toBeCloseTo(rest.dist);
    expect(end.pitch).toBeCloseTo(rest.pitch);
  });

  it('곡선은 0과 1에서 멈춘다', () => {
    expect(ease(-1)).toBe(0); expect(ease(2)).toBe(1); expect(ease(0.5)).toBeCloseTo(0.5);
    expect(easeOut(0)).toBe(0); expect(easeOut(1)).toBe(1); expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe('시작 화면 구도', () => {
  const facade = { x: 0, y: 4.2, z: 9 };
  it('넓은 화면은 건물 왼쪽을 보고(건물이 오른쪽에 온다) 앞쪽 위에서 본다', () => {
    const s = titleShot(facade, 1.6, 0);
    expect(s.look.x).toBeLessThan(facade.x);
    expect(s.pos.z).toBeGreaterThan(facade.z + 20);
    expect(s.pos.y).toBeGreaterThan(facade.y);
  });
  it('세로 화면은 시선을 낮춰 건물을 위쪽 절반에 둔다', () => {
    const s = titleShot(facade, 0.46, 0);
    expect(s.look.x).toBe(facade.x);
    expect(s.look.y).toBeLessThan(facade.y - 2);
  });
  it('흔들림은 좌우 3° 안이다', () => {
    const base = titleShot(facade, 1.6, 0), angle = (p: { x: number; z: number }) => Math.atan2(p.x - facade.x, p.z - facade.z) * 180 / Math.PI;
    for (let d = 0; d <= 20; d += 0.5) expect(Math.abs(angle(titleShot(facade, 1.6, d).pos) - angle(base.pos))).toBeLessThanOrEqual(3.0001);
  });
});
