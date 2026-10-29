// 큐레이션 문장 틀(3D미술관_재설계 §2-4). 보호자가 적은 값만 끼운다 — 적지 않은 사실(감정 · 재능 · 기법)은 쓰지 않는다.
import { josa } from '@/copy/josa';
import { subjectOf, SUBJECT_GROUPS, type SubjectGroup } from './subjects';

export interface CurationInput {
  no: number;
  title: string;
  kind: 'drawing' | 'making';
  subject: string;
  material: string;
  age: number;
  madeOn: string; // YYYY-MM-DD
  words: string;
  child: string;
}

export interface Plaque { title: string; byline: string; detail: string; number: string }

function yearMonth(madeOn: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(madeOn.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

/** 나이별 전시실 이름(§2-15). 나이 0은 나이를 모르는 작품이 모이는 "새로 온 작품" 방이다 */
export function roomTitle(age: number): string {
  return age === 0 ? '새로 온 작품' : `${age}세관`;
}

/** 한눈에 보기(§2-18): 나이 순(나이 모름이 맨 앞)으로 묶고, 묶음 안은 번호 순 */
export function ageGroups<T extends { age: number; no: number }>(works: readonly T[]): Array<{ age: number; title: string; works: T[] }> {
  const by = new Map<number, T[]>();
  for (const w of works) by.set(w.age, [...(by.get(w.age) ?? []), w]);
  return [...by.keys()].sort((a, b) => a - b).map((age) => ({ age, title: roomTitle(age), works: by.get(age)!.slice().sort((a, b) => a.no - b.no) }));
}

/** 명패 아래 짧은 줄: "5세 · 2026년 3월". 적지 않은 값은 빼고, 둘 다 없으면 빈 문자열 */
export function whenLine(a: Pick<CurationInput, 'age' | 'madeOn'>): string {
  const ym = yearMonth(a.madeOn);
  return [a.age > 0 ? `${a.age}세` : '', ym ? `${ym.y}년 ${ym.m}월` : ''].filter(Boolean).join(' · ');
}

/** 제목을 비웠을 때: "{주제} 그림" · 주제도 없으면 "무제" */
export function defaultTitle(subject: string, kind: CurationInput['kind']): string {
  const s = subjectOf(subject);
  if (s.id === 'etc') return '새 작품'; // §2-15: 모르면 '새 작품'
  return `${s.label} ${kind === 'making' ? '만들기' : '그림'}`;
}

export function plaqueOf(a: CurationInput): Plaque {
  const ym = yearMonth(a.madeOn);
  const detail = [a.material.trim(), ym ? `${ym.y}` : ''].filter(Boolean).join(', ');
  return {
    title: a.title.trim() || defaultTitle(a.subject, a.kind),
    byline: a.age > 0 ? `${a.child}, ${a.age}세` : a.child, // 나이 0은 미분류(§2-15): 나이를 지어 쓰지 않는다
    detail,
    number: `No. ${String(a.no).padStart(3, '0')}`,
  };
}

/** 큐레이터 노트: 합니다체 한두 문장 + 아이의 말은 따로(인용) */
export function curatorNote(a: CurationInput): { lines: string[]; quote: string | null } {
  const s = subjectOf(a.subject);
  const what = s.id === 'etc' ? '작품' : s.label;
  const verb = a.kind === 'making' ? '만든' : '그린';
  const mat = a.material.trim();
  const first = `${josa(a.child, '이/가')} ${a.age > 0 ? `${a.age}세에 ` : ''}${mat ? `${josa(mat, '으로/로')} ` : ''}${verb} ${what}입니다.`;
  const lines = [first];
  const ym = yearMonth(a.madeOn);
  if (ym) lines.push(`${ym.y}년 ${ym.m}월의 작품입니다.`);
  const quote = a.words.trim() ? a.words.trim() : null;
  return { lines, quote };
}

/** 전시실 부제: 주제 묶음별 점수만 센다(해석 문장 없음). 예: "동물 3점 · 탈것 2점" */
export function roomSubtitle(subjects: string[]): string {
  if (!subjects.length) return '아직 걸린 작품이 없어요';
  const count = new Map<SubjectGroup, number>();
  for (const id of subjects) {
    const g = subjectOf(id).group;
    count.set(g, (count.get(g) ?? 0) + 1);
  }
  return SUBJECT_GROUPS.filter((g) => count.has(g)).map((g) => `${g} ${count.get(g)}점`).join(' · ');
}

/** 오디오 가이드로 읽을 글 */
export function guideText(a: CurationInput): string {
  const p = plaqueOf(a);
  const n = curatorNote(a);
  return [p.title, ...n.lines, n.quote ? `아이가 한 말, ${n.quote}` : '']
    .map((s) => s.trim().replace(/\.+$/, ''))
    .filter(Boolean)
    .join('. ');
}
