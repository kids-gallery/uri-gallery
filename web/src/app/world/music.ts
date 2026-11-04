// 모드별 배경 음악 악보(마스터플랜 3-3 #137). 소리 파일 없이 sound.ts가 합성한다. 곡은 이 프로젝트에서 직접 쓴 짧은 반복이다.
import type { ThemeId } from './themes';

export type Voice = 'organ' | 'marimba' | 'flute' | 'pad' | 'bell' | 'bass';
/** at, len은 박 단위. midi는 음 높이(69 = 라4). vel은 0~1 */
export interface Note { at: number; midi: number; len: number; voice: Voice; vel: number }
export interface Score { bpm: number; beats: number; echo: { time: number; feedback: number }; notes: Note[] }

const chords = (voice: Voice, vel: number, len: number, list: number[][]): Note[] =>
  list.flatMap((c, i) => c.map((midi) => ({ at: i * len, midi, len, voice, vel })));
const line = (voice: Voice, vel: number, step: number, list: number[]): Note[] =>
  list.map((midi, i) => ({ at: i * step, midi, len: step, voice, vel: i % 2 ? vel * 0.75 : vel }));
const phrase = (voice: Voice, vel: number, list: [at: number, midi: number, len: number][]): Note[] =>
  list.map(([at, midi, len]) => ({ at, midi, len, voice, vel }));
const score = (bpm: number, beats: number, echo: Score['echo'], ...parts: Note[][]): Score =>
  ({ bpm, beats, echo, notes: parts.flat().sort((a, b) => a.at - b.at) });

export const SCORES: Record<ThemeId, Score> = {
  // 대성당: 느린 오르간 화음(다장조 C Am F G)
  classic: score(56, 16, { time: 0.42, feedback: 0.42 },
    chords('organ', 0.7, 4, [[48, 55, 60, 64], [45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62]]),
    phrase('organ', 0.55, [[0, 76, 2], [2, 79, 2], [4, 76, 2], [6, 72, 2], [8, 69, 2], [10, 72, 2], [12, 71, 2], [14, 74, 2]])),
  // 공방: 나무 실로폰 8분음 분산 화음(라장조 D Bm G A)
  block: score(104, 16, { time: 0.29, feedback: 0.18 },
    line('marimba', 0.7, 0.5, [62, 69, 74, 69, 66, 69, 74, 69, 59, 66, 71, 66, 62, 66, 71, 66, 55, 62, 67, 62, 59, 62, 67, 62, 57, 64, 69, 64, 61, 64, 69, 64]),
    phrase('bass', 0.7, [[0, 38, 2], [2, 45, 2], [4, 35, 2], [6, 42, 2], [8, 43, 2], [10, 38, 2], [12, 45, 2], [14, 40, 2]])),
  // 숲: 피리와 은은한 화음(바장조 5음 F Dm B♭ C)
  forest: score(72, 16, { time: 0.36, feedback: 0.34 },
    chords('pad', 0.7, 4, [[53, 60, 65], [50, 57, 62], [46, 53, 58], [48, 55, 60]]),
    phrase('flute', 0.7, [[0, 81, 1.5], [1.5, 79, 0.5], [2, 77, 2], [4, 74, 1], [5, 77, 1], [6, 79, 2], [8, 77, 1], [9, 74, 1], [10, 72, 2], [12, 74, 1], [13, 72, 1], [14, 69, 2]])),
  // 장난감: 오르골(사장조 G C G D)
  toy: score(116, 16, { time: 0.26, feedback: 0.22 },
    line('bell', 0.75, 0.5, [79, 83, 86, 83, 91, 86, 83, 86, 76, 79, 84, 79, 88, 84, 79, 84, 79, 83, 86, 91, 86, 83, 79, 83, 74, 78, 81, 86, 81, 78, 74, 78]),
    phrase('bass', 0.45, [[0, 55, 2], [2, 62, 2], [4, 48, 2], [6, 55, 2], [8, 55, 2], [10, 62, 2], [12, 50, 2], [14, 57, 2]])),
};
