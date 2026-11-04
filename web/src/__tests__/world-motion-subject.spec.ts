import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { motionSubject, SUBJECTS, subjectOf } from '../app/world/subjects';

describe('M2 태그 → 움직임(마스터플랜 3-3)', () => {
  it('로켓은 날고, 물고기는 헤엄치고, 자동차는 달린다', () => {
    expect(subjectOf(motionSubject(['로켓'])).behavior).toBe('fly');
    expect(subjectOf(motionSubject(['물고기'])).behavior).toBe('swim');
    expect(subjectOf(motionSubject(['자동차'])).behavior).toBe('drive');
  });
  it('표에 있는 첫 태그를 쓰고, 없으면 기본 동작에 맡긴다', () => {
    expect(motionSubject(['바다', '고래', '사람'])).toBe('whale');
    expect(motionSubject(['하늘'])).toBeUndefined();
    expect(motionSubject([])).toBeUndefined();
    expect(motionSubject(undefined)).toBeUndefined();
  });
  it('M2 어휘는 배경 태그 둘을 빼면 모두 주제 표에 있다. 이름이 어긋나면 조용히 기본 동작이 된다', () => {
    const yaml = readFileSync(resolve(__dirname, '../../../serving/config/m2_prompts.yaml'), 'utf8');
    const tags = yaml.split('\ntags:\n')[1]!.split('\ntag_top_k')[0]!.split('\n').map((l) => l.trim().split(':')[0]!);
    const labels = new Set(SUBJECTS.map((s) => s.label));
    expect(tags.filter((t) => !labels.has(t))).toEqual(['바다', '하늘']);
  });
});
