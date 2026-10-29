// 3D미술관_재설계 §2-18 — 배경 지우기 틈 메우기, 한눈에 보기 묶음. 순수 함수 시험.
import { describe, expect, it } from 'vitest';
import { closeOutline, fillEnclosed } from '@/app/world/cutout';
import { ageGroups, roomTitle, whenLine } from '@/app/world/curation';

const W = 288, H = 384, R = Math.max(2, Math.round(Math.max(W, H) * 0.012));

/** 이어 칠하기 뒤의 전경: 두께 4칸 타원 윤곽선만 남은 그림. gap은 오른쪽 끝에서 비운 칸 수 */
function outline(gap: number): Uint8Array {
  const m = new Uint8Array(W * H), cx = 144, cy = 220, a = 86, b = 115;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - cx) / a, (y - cy) / b);
    if (Math.abs(d - 1) * Math.min(a, b) > 2) continue;
    if (x > cx && Math.abs(y - cy) < gap / 2) continue;
    m[y * W + x] = 1;
  }
  return m;
}
const count = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);
const center = (m: Uint8Array) => m[220 * W + 144];

describe('배경 지우기 틈 메우기(§2-18)', () => {
  it('닫힌 윤곽은 안쪽을 채운다', () => {
    const filled = fillEnclosed(outline(0), W, H, R);
    expect(center(filled)).toBe(1);
  });

  it('8칸 틈, 긴 변의 6% 틈이 있어도 닫힌 윤곽과 같은 넓이로 채운다(±10%)', () => {
    const closed = count(closeOutline(outline(0), W, H));
    for (const g of [8, Math.round(H * 0.06)]) {
      const gap = closeOutline(outline(g), W, H);
      expect(center(gap)).toBe(1);
      expect(Math.abs(count(gap) - closed) / closed).toBeLessThan(0.1);
    }
  });

  it('긴 변의 12%보다 넓은 틈은 열린 것으로 본다(바깥 넘침 방지)', () => {
    const wide = closeOutline(outline(Math.ceil(H * 0.12) + 4), W, H);
    expect(center(wide)).toBe(0);
  });

  it('닫힌 윤곽은 가장 작은 반지름에서 멈춘다(귀 사이를 메우지 않는다)', () => {
    expect(closeOutline(outline(0), W, H)).toEqual(fillEnclosed(outline(0), W, H, R));
  });

  it('선 없이 색칠만 있는 덩어리는 넓이가 바뀌지 않는다', () => {
    const blob = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - 144, y - 200) < 90) blob[y * W + x] = 1;
    expect(count(closeOutline(blob, W, H))).toBe(count(blob));
  });

  it('윤곽 바깥으로 넓히지 않는다', () => {
    const filled = closeOutline(outline(Math.round(H * 0.06)), W, H);
    expect(filled[10 * W + 10]).toBe(0);
    expect(filled[220 * W + 144 + 86 + 4 * R + 3]).toBe(0);
  });
});

describe('한눈에 보기 묶음(§2-18)', () => {
  const w = (age: number, no: number) => ({ age, no });

  it('나이 모름이 맨 앞, 나머지는 나이 순, 묶음 안은 번호 순', () => {
    const g = ageGroups([w(6, 3), w(0, 5), w(4, 2), w(6, 1), w(0, 4)]);
    expect(g.map((x) => x.title)).toEqual(['새로 온 작품', '4세관', '6세관']);
    expect(g[2]!.works.map((x) => x.no)).toEqual([1, 3]);
  });

  it('전시실 이름은 엔진과 같은 규칙', () => {
    expect(roomTitle(0)).toBe('새로 온 작품');
    expect(roomTitle(5)).toBe('5세관');
  });

  it('짧은 줄은 적은 값만 쓴다', () => {
    expect(whenLine({ age: 5, madeOn: '2026-03-14' })).toBe('5세 · 2026년 3월');
    expect(whenLine({ age: 0, madeOn: '' })).toBe('');
    expect(whenLine({ age: 0, madeOn: '2025-11-02' })).toBe('2025년 11월');
  });
});
