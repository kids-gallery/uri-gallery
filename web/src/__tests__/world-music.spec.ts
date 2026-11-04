// 모드별 배경 음악 악보(마스터플랜 3-3 #137). 사람 귀를 대신하지 못하지만, 음이 조에 맞고 모드마다 다른지는 본다.
import { describe, expect, it } from 'vitest';
import { SCORES } from '@/app/world/music';

// 각 모드의 조에 속한 음이름(0 = 도)
const KEYS = { classic: [0, 2, 4, 5, 7, 9, 11], block: [2, 4, 6, 7, 9, 11, 1], forest: [5, 7, 9, 10, 0, 2, 4], toy: [7, 9, 11, 0, 2, 4, 6] } as const;
const THEMES = ['classic', 'block', 'forest', 'toy'] as const;

describe('모드별 배경 음악', () => {
  it.each(THEMES)('%s: 모든 음이 조 안에 있고 반복 길이를 넘지 않는다', (t) => {
    const s = SCORES[t];
    expect(s.notes.length).toBeGreaterThan(8);
    for (const n of s.notes) {
      expect(KEYS[t]).toContain(n.midi % 12);
      expect(n.midi).toBeGreaterThanOrEqual(33);
      expect(n.midi).toBeLessThanOrEqual(96);
      expect(n.at + n.len).toBeLessThanOrEqual(s.beats);
      expect(n.vel).toBeGreaterThan(0);
      expect(n.vel).toBeLessThanOrEqual(1);
    }
  });
  it('음표가 시간 순이다(예약이 앞에서부터 나간다)', () => {
    for (const t of THEMES) {
      const at = SCORES[t].notes.map((n) => n.at);
      expect(at).toEqual([...at].sort((a, b) => a - b));
    }
  });
  it('네 모드의 빠르기와 음색이 서로 다르다', () => {
    expect(new Set(THEMES.map((t) => SCORES[t].bpm)).size).toBe(4);
    const voices = THEMES.map((t) => [...new Set(SCORES[t].notes.map((n) => n.voice))].sort().join());
    expect(new Set(voices).size).toBe(4);
  });
});
