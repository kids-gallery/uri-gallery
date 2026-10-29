// 주제 → 행동 · 소리 표(3D미술관_재설계 §2-5). 주제를 더할 때는 이 표에 한 줄만 더한다.
// icon: 결과 카드에서 "무엇을 그렸나요"를 고르는 그림 단추(§2-22 4)
export type Behavior = 'run' | 'fly' | 'drive' | 'swim' | 'grow' | 'dance' | 'spin';
export type SoundId = 'roar' | 'bark' | 'hop' | 'whoosh' | 'flap' | 'float' | 'vroom' | 'bubble' | 'sparkle' | 'tune' | 'tada';
export type SubjectGroup = '동물' | '하늘' | '탈것' | '바다' | '자연' | '사람' | '그 밖';

export interface Subject { id: string; label: string; icon: string; group: SubjectGroup; behavior: Behavior; sound: SoundId }

export const SUBJECTS: readonly Subject[] = [
  { id: 'tiger', label: '호랑이', icon: '🐯', group: '동물', behavior: 'run', sound: 'roar' },
  { id: 'lion', label: '사자', icon: '🦁', group: '동물', behavior: 'run', sound: 'roar' },
  { id: 'dino', label: '공룡', icon: '🦖', group: '동물', behavior: 'run', sound: 'roar' },
  { id: 'dog', label: '강아지', icon: '🐶', group: '동물', behavior: 'run', sound: 'bark' },
  { id: 'cat', label: '고양이', icon: '🐱', group: '동물', behavior: 'run', sound: 'hop' },
  { id: 'rabbit', label: '토끼', icon: '🐰', group: '동물', behavior: 'run', sound: 'hop' },
  { id: 'bear', label: '곰', icon: '🐻', group: '동물', behavior: 'run', sound: 'hop' },
  { id: 'rocket', label: '로켓', icon: '🚀', group: '하늘', behavior: 'fly', sound: 'whoosh' },
  { id: 'plane', label: '비행기', icon: '✈️', group: '하늘', behavior: 'fly', sound: 'whoosh' },
  { id: 'bird', label: '새', icon: '🐦', group: '하늘', behavior: 'fly', sound: 'flap' },
  { id: 'butterfly', label: '나비', icon: '🦋', group: '하늘', behavior: 'fly', sound: 'flap' },
  { id: 'balloon', label: '풍선', icon: '🎈', group: '하늘', behavior: 'fly', sound: 'float' },
  { id: 'car', label: '자동차', icon: '🚗', group: '탈것', behavior: 'drive', sound: 'vroom' },
  { id: 'train', label: '기차', icon: '🚂', group: '탈것', behavior: 'drive', sound: 'vroom' },
  { id: 'bus', label: '버스', icon: '🚌', group: '탈것', behavior: 'drive', sound: 'vroom' },
  { id: 'ship', label: '배', icon: '⛵', group: '탈것', behavior: 'drive', sound: 'vroom' },
  { id: 'fish', label: '물고기', icon: '🐟', group: '바다', behavior: 'swim', sound: 'bubble' },
  { id: 'whale', label: '고래', icon: '🐳', group: '바다', behavior: 'swim', sound: 'bubble' },
  { id: 'octopus', label: '문어', icon: '🐙', group: '바다', behavior: 'swim', sound: 'bubble' },
  { id: 'flower', label: '꽃', icon: '🌸', group: '자연', behavior: 'grow', sound: 'sparkle' },
  { id: 'tree', label: '나무', icon: '🌳', group: '자연', behavior: 'grow', sound: 'sparkle' },
  { id: 'sun', label: '해', icon: '☀️', group: '자연', behavior: 'grow', sound: 'sparkle' },
  { id: 'rainbow', label: '무지개', icon: '🌈', group: '자연', behavior: 'grow', sound: 'sparkle' },
  { id: 'person', label: '사람', icon: '🧒', group: '사람', behavior: 'dance', sound: 'tune' },
  { id: 'family', label: '가족', icon: '👨‍👩‍👧', group: '사람', behavior: 'dance', sound: 'tune' },
  { id: 'robot', label: '로봇', icon: '🤖', group: '사람', behavior: 'dance', sound: 'tune' },
  { id: 'snowman', label: '눈사람', icon: '⛄', group: '사람', behavior: 'dance', sound: 'tune' },
  { id: 'character', label: '캐릭터', icon: '🦸', group: '사람', behavior: 'dance', sound: 'tune' },
  { id: 'house', label: '집', icon: '🏠', group: '그 밖', behavior: 'spin', sound: 'tada' },
  { id: 'etc', label: '그 밖', icon: '✨', group: '그 밖', behavior: 'spin', sound: 'tada' },
];

const BY_ID = new Map(SUBJECTS.map((s) => [s.id, s]));
export const FALLBACK_SUBJECT: Subject = BY_ID.get('etc')!;

export function subjectOf(id: string | undefined | null): Subject {
  return (id && BY_ID.get(id)) || FALLBACK_SUBJECT;
}

export const SUBJECT_GROUPS: readonly SubjectGroup[] = ['동물', '하늘', '탈것', '바다', '자연', '사람', '그 밖'];

export const MATERIALS: readonly string[] = ['크레파스', '색연필', '사인펜', '물감', '연필', '스티커', '찰흙', '종이 상자', '색종이', '블록'];
