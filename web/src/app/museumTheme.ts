// 홈 전시 공간 시안 전환(D30, SD_02 §17-5 — 시안, 팀 선택 전). 화면 코드는 값을 직접 쓰지 않고 여기서만 읽는다.
// 'v2' = 지금 main 홈(§17-3 · §17-4) · 'classic-a' = 건축만 고전(흑백 액자 · 크림 벽) · 'classic-b' = 전체 고전(금빛 액자 · 방마다 깊은 벽색).
import { ko } from '../copy/ko'; // 상대 경로 — E2E(Playwright)에서도 같은 이름을 쓴다

export type MuseumTheme = 'v2' | 'classic-a' | 'classic-b';
const THEMES: readonly MuseumTheme[] = ['v2', 'classic-a', 'classic-b'];

/** 시안 전환은 이 한 줄만 바꾼다. 빌드할 때는 VITE_MUSEUM_THEME로 덮어쓸 수 있다. */
export const MUSEUM_THEME_DEFAULT: MuseumTheme = 'classic-a';

export function museumTheme(): MuseumTheme {
  const env = import.meta.env?.VITE_MUSEUM_THEME as string | undefined; // E2E(node)에는 env가 없다
  return THEMES.includes(env as MuseumTheme) ? (env as MuseumTheme) : MUSEUM_THEME_DEFAULT;
}
export const isClassic = (t: MuseumTheme = museumTheme()) => t !== 'v2';

/** 전시실 번호 — 나이가 어린 순서로 1부터(아이마다 따로). */
export function roomNumbers<T extends { ageAtMaking: number }>(rooms: readonly T[]): Map<number, number> {
  return new Map([...rooms].map((r) => r.ageAtMaking).sort((a, b) => a - b).map((age, i) => [age, i + 1]));
}
/** 전시실 이름: v2 "N세관" · 고전 시안 "제N전시실 · N살" */
export function roomLabel(no: number, age: number, t: MuseumTheme = museumTheme()): string {
  return isClassic(t) ? ko.classic.room(no, age) : ko.museum.room(age);
}
