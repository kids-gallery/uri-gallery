// 3D미술관_재설계 §2-23 — 사용자 흐름 점검 수정 중 단위 시험으로 고정할 수 있는 것.
import { describe, expect, it } from 'vitest';
import { turned } from '@/app/world/store';
import { THEMES } from '@/app/world/themes';

describe('사진 돌리기 방향(§2-23 B)', () => {
  it('오른쪽은 +90°, 왼쪽은 −90°, 결과는 0·90·180·270', () => {
    expect(turned(0, 1)).toBe(90);
    expect(turned(0, -1)).toBe(270);
    expect(turned(270, 1)).toBe(0);
    expect(turned(90, -1)).toBe(0);
  });
  it('왼쪽 한 번 = 오른쪽 세 번(오른쪽으로 누운 사진을 한 번에 세운다)', () => {
    let right = 0;
    for (let i = 0; i < 3; i++) right = turned(right, 1);
    expect(turned(0, -1)).toBe(right);
  });
});

describe('모드 설명(§2-23 G)', () => {
  it('클래식은 대성당 모습을 설명한다(옛 "중정" 설명 없음)', () => {
    const classic = THEMES.find((t) => t.id === 'classic')!;
    expect(classic.note).toContain('대성당');
    expect(THEMES.some((t) => t.note.includes('중정'))).toBe(false);
  });
});
