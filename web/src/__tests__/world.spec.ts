// 개인 확장 3D 미술관(design/개인확장/3D미술관_재설계.md) — 순수 함수 시험.
// AT-UC07-01·02(큐레이션에 입력 밖 사실 없음), AT-UC11(전시실), 입체화 윤곽, 주제 표, 캐릭터 설정 복구.
import { describe, expect, it } from 'vitest';
import rules from './fixtures/assertion_words.json';
import { curatorNote, defaultTitle, guideText, plaqueOf, roomSubtitle, type CurationInput } from '@/app/world/curation';
import { planRooms, PEDESTAL_SLOTS, WALL_SLOTS, MAX_AGE } from '@/app/world/museum';
import { contours, simplify, type Mask } from '@/app/world/cutout';
import { SUBJECTS, subjectOf, FALLBACK_SUBJECT } from '@/app/world/subjects';
import { DEFAULT_AVATAR, normalizeAvatar } from '@/app/world/avatar';

const base: CurationInput = { no: 3, title: '', kind: 'drawing', subject: 'etc', material: '', age: 5, madeOn: '', words: '', child: '하늘' };
const assertion = Object.entries(rules.assertion_words as Record<string, string[]>).filter(([k]) => k !== 'material').flatMap(([, v]) => v);

function text(a: CurationInput) {
  const n = curatorNote(a);
  const p = plaqueOf(a);
  return [p.title, p.byline, p.detail, ...n.lines].join(' ');
}

describe('큐레이션 문장: 입력한 값만 쓴다', () => {
  it('모두 비우면 새 작품 · 나이 · 이름만(§2-15)', () => {
    const p = plaqueOf(base);
    expect(p).toEqual({ title: '새 작품', byline: '하늘, 5세', detail: '', number: 'No. 003' });
    expect(curatorNote(base)).toEqual({ lines: ['하늘이 5세에 그린 작품입니다.'], quote: null });
  });

  it('재료를 비우면 재료 낱말이 없다', () => {
    const t = text({ ...base, subject: 'tiger' });
    for (const m of rules.assertion_words.material) expect(t).not.toContain(m);
  });

  it('재료를 적으면 그 재료만 나온다', () => {
    const a = { ...base, subject: 'rocket', material: '색연필', kind: 'making' as const };
    expect(curatorNote(a).lines[0]).toBe('하늘이 5세에 색연필로 만든 로켓입니다.');
    expect(plaqueOf(a).detail).toBe('색연필');
    const others = rules.assertion_words.material.filter((m) => !'색연필'.includes(m));
    for (const m of others) expect(text(a)).not.toContain(m);
  });

  it('감정 · 재능 · 가족 사건 단정 낱말이 없다(아이의 말은 따로 인용)', () => {
    const a = { ...base, subject: 'family', words: '엄마랑 놀러 갔어 행복해', madeOn: '2026-10-20' };
    const t = text(a);
    for (const w of assertion) expect(t).not.toContain(w);
    expect(curatorNote(a).quote).toBe('엄마랑 놀러 갔어 행복해');
    expect(curatorNote(a).lines[1]).toBe('2026년 10월의 작품입니다.');
  });

  it('받침에 맞는 조사', () => {
    expect(curatorNote({ ...base, child: '도아' }).lines[0]).toBe('도아가 5세에 그린 작품입니다.');
    expect(curatorNote({ ...base, material: '찰흙', kind: 'making' }).lines[0]).toBe('하늘이 5세에 찰흙으로 만든 작품입니다.');
  });

  it('기본 제목', () => {
    expect(defaultTitle('tiger', 'drawing')).toBe('호랑이 그림');
    expect(defaultTitle('robot', 'making')).toBe('로봇 만들기');
    expect(defaultTitle('없는 주제', 'drawing')).toBe('새 작품');
  });

  it('오디오 가이드는 명패와 노트, 아이의 말을 구분해 읽는다', () => {
    expect(guideText({ ...base, title: '달나라', words: '달에 갈래' })).toBe('달나라. 하늘이 5세에 그린 작품입니다. 아이가 한 말, 달에 갈래');
  });

  it('전시실 부제는 묶음별 수만 센다', () => {
    expect(roomSubtitle([])).toBe('아직 걸린 작품이 없어요');
    expect(roomSubtitle(['tiger', 'cat', 'car', 'rocket', 'tiger'])).toBe('동물 3점 · 하늘 1점 · 탈것 1점');
  });
});

describe('전시실 계획', () => {
  const w = (id: string, age: number, kind: 'drawing' | 'making' = 'drawing', order = 0) => ({ id, age, kind, order });

  it('나이 목록과 작품 나이를 합쳐 방을 만든다(정렬 · 범위 밖 제외 · 0은 미분류 방)', () => {
    const { rooms } = planRooms([7, 4], [w('a', 9), w('b', 0), w('c', MAX_AGE + 1), w('d', -1)]);
    expect(rooms).toEqual([{ age: 0, part: 1 }, { age: 4, part: 1 }, { age: 7, part: 1 }, { age: 9, part: 1 }]);
  });

  it('나이를 모르면 명패와 노트에 나이를 쓰지 않는다(§2-15)', () => {
    const p = plaqueOf({ no: 1, title: '', kind: 'drawing', subject: 'etc', material: '', age: 0, madeOn: '', words: '', child: '우리 아이' });
    expect(p.byline).toBe('우리 아이');
    expect(p.title).toBe('새 작품');
    expect(curatorNote({ no: 1, title: '', kind: 'drawing', subject: 'etc', material: '', age: 0, madeOn: '', words: '', child: '우리 아이' }).lines[0]).not.toMatch(/세에/);
  });

  it('만들기는 언제나 받침대에 서고, 차면 다음 전시실로 넘어간다', () => {
    const list = Array.from({ length: PEDESTAL_SLOTS + 1 }, (_, i) => w(`m${i}`, 5, 'making', i));
    const { slots } = planRooms([5], list);
    expect([...slots.values()].every((s) => s.type === 'pedestal')).toBe(true);
    expect(slots.get(`m${PEDESTAL_SLOTS}`)).toEqual({ room: 1, type: 'pedestal', index: 0 });
  });

  it('벽이 차면 같은 나이의 다음 방', () => {
    const list = Array.from({ length: WALL_SLOTS + 2 }, (_, i) => w(`d${i}`, 6, 'drawing', i));
    const { rooms, slots } = planRooms([6], list);
    expect(rooms).toEqual([{ age: 6, part: 1 }, { age: 6, part: 2 }]);
    expect(slots.get(`d${WALL_SLOTS}`)).toEqual({ room: 1, type: 'wall', index: 0 });
  });
});

describe('입체화 윤곽', () => {
  it('사각형 덩어리는 꼭짓점 몇 개로 줄어든다', () => {
    const W = 20, H = 12;
    const data = new Uint8Array(W * H);
    for (let y = 3; y < 9; y++) for (let x = 4; x < 16; x++) data[y * W + x] = 1;
    const mask: Mask = { w: W, h: H, data, ok: true, ratio: 0.3 };
    const cs = contours(mask);
    expect(cs).toHaveLength(1);
    const xs = cs[0]!.map((p) => p[0]), ys = cs[0]!.map((p) => p[1]);
    expect(Math.min(...xs)).toBe(4); expect(Math.max(...xs)).toBe(16);
    expect(Math.min(...ys)).toBe(3); expect(Math.max(...ys)).toBe(9);
    expect(cs[0]!.length).toBeLessThanOrEqual(8);
  });

  it('배경을 못 찾은 마스크는 윤곽이 없다(사각형 판으로 걸린다)', () => {
    expect(contours({ w: 2, h: 2, data: new Uint8Array(4), ok: false, ratio: 0 })).toEqual([]);
  });

  it('점 줄이기는 직선 위의 점을 지운다', () => {
    const line: Array<[number, number]> = Array.from({ length: 10 }, (_, i) => [i, 0] as [number, number]);
    const pts = simplify([...line, [9, 5], [0, 5]], 0.5);
    expect(pts.length).toBeLessThan(8);
  });
});

describe('주제 표', () => {
  it('모든 주제에 행동과 소리가 있고 id가 겹치지 않는다', () => {
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(SUBJECTS.length);
    for (const s of SUBJECTS) { expect(s.behavior).toBeTruthy(); expect(s.sound).toBeTruthy(); }
    expect(subjectOf('tiger')).toMatchObject({ behavior: 'run', sound: 'roar' });
    expect(subjectOf('rocket')).toMatchObject({ behavior: 'fly', sound: 'whoosh' });
    expect(subjectOf(undefined)).toBe(FALLBACK_SUBJECT);
  });

  it('행동 7가지가 모두 쓰인다', () => {
    expect(new Set(SUBJECTS.map((s) => s.behavior))).toEqual(new Set(['run', 'fly', 'drive', 'swim', 'grow', 'dance', 'spin']));
  });
});

describe('캐릭터 설정 복구', () => {
  it('깨진 값은 기본값으로', () => {
    expect(normalizeAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normalizeAvatar({ hair: 'mohawk', skin: 'red', mode: 'image' })).toMatchObject({ hair: DEFAULT_AVATAR.hair, skin: DEFAULT_AVATAR.skin, mode: 'image' });
  });
});
