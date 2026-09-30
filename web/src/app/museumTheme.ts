// 홈 전시 공간 전환(D30 시안 → D31 결정, SD_02 §17-5 · §17-6). 화면 코드는 값을 직접 쓰지 않고 여기서만 읽는다.
// 'v2' = 이전 홈(§17-3 · §17-4) · 'walk' = 걸어 다니는 미술관(§17-6: 홈 /app, 한눈에 보기 /app/list — 금빛 액자 · 고른 벽 색).
import { ko } from '../copy/ko'; // 상대 경로 — E2E(Playwright)에서도 같은 이름을 쓴다

export type MuseumTheme = 'v2' | 'walk';
const THEMES: readonly MuseumTheme[] = ['v2', 'walk'];

/** 전환은 이 한 줄만 바꾼다. 빌드할 때는 VITE_MUSEUM_THEME로 덮어쓸 수 있다. */
export const MUSEUM_THEME_DEFAULT: MuseumTheme = 'walk';

export function museumTheme(): MuseumTheme {
  const env = import.meta.env?.VITE_MUSEUM_THEME as string | undefined; // E2E(node)에는 env가 없다
  return THEMES.includes(env as MuseumTheme) ? (env as MuseumTheme) : MUSEUM_THEME_DEFAULT;
}
export const isClassic = (t: MuseumTheme = museumTheme()) => t !== 'v2';

/** 전시실 번호 — 나이가 어린 순서로 1부터(아이마다 따로). */
export function roomNumbers<T extends { ageAtMaking: number }>(rooms: readonly T[]): Map<number, number> {
  return new Map([...rooms].map((r) => r.ageAtMaking).sort((a, b) => a - b).map((age, i) => [age, i + 1]));
}
/** 전시실 이름(한눈에 보기 · 전시실 목록): v2 "N세관" · walk "제N전시실 · N살" */
export function roomLabel(no: number, age: number, t: MuseumTheme = museumTheme()): string {
  return isClassic(t) ? ko.classic.room(no, age) : ko.museum.room(age);
}
