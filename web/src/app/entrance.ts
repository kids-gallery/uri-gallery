// 첫 방문 입장 화면(S0w, SD_02 §17-2) 여부 — 브라우저 저장값 하나. 읽거나 쓰지 못하면(사생활 보호 모드 등) 입장 화면을 건너뛴다.
const KEY = 'uam.entered';

export function isFirstVisit(): boolean {
  try { return localStorage.getItem(KEY) !== '1'; } catch { return false; }
}

export function markEntered(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* 저장소 없음 — 다음에도 입장 화면 없이 로그인 */ }
}
