// 이 기기에서 작품이 지워질 위험과 백업 권유(3D미술관_재설계 §2-22 5~7, 설계도 7-5). 판정은 표와 순수 함수, 화면은 결과만 쓴다.
// 근거(2026-10-28 확인): WebKit 추적 방지 정책은 7일 동안 상호작용이 없는 사이트의 스크립트 저장소를 지우고 홈 화면 웹앱은 빼며,
// 홈 화면 웹앱의 자료는 Safari와 따로 둔다. persist() 허용도 같은 기준이다(WebKit 저장 정책).

/** home-app = 홈 화면에 추가한 앱으로 열림, ios-tab = iPhone·iPad 브라우저 탭(7일 삭제 대상), browser = 그 밖 */
export type StorageMode = 'home-app' | 'ios-tab' | 'browser';
export interface DeviceInfo { ua: string; maxTouchPoints: number; standalone: boolean }

/** iPadOS 13 이후 Safari는 Mac처럼 자신을 알리므로 터치 지점 수로 가른다 */
export function isIOS(d: DeviceInfo): boolean {
  return /iPhone|iPad|iPod/.test(d.ua) || (/Macintosh/.test(d.ua) && d.maxTouchPoints > 1);
}
export function storageMode(d: DeviceInfo): StorageMode {
  if (d.standalone) return 'home-app';
  return isIOS(d) ? 'ios-tab' : 'browser';
}
/** 지금 기기. standalone은 표준 미디어 쿼리와 iOS의 navigator.standalone 둘 다 본다 */
export function currentDevice(): DeviceInfo {
  const nav = navigator as Navigator & { standalone?: boolean };
  return { ua: nav.userAgent, maxTouchPoints: nav.maxTouchPoints ?? 0, standalone: nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches };
}

/** 백업 권유 조건 표(§2-22 7): 백업에 없는 작품이 이만큼 쌓이거나 이만큼 지나면 한 줄로 권한다 */
export const BACKUP_NUDGE = { works: 10, days: 30 } as const;
const DAY = 24 * 60 * 60 * 1000;

/**
 * 권유할 때인가. times = 이 가족이 직접 올린 작품의 만든 시각(견본 제외).
 * 마지막 백업 뒤 작품이 백업에 없는 작품이다. [나중에]를 누른 뒤에는 그때부터 다시 세고 잰다.
 */
export function backupDue(mark: { lastAt?: number; laterAt?: number }, times: number[], now: number, rule: { works: number; days: number } = BACKUP_NUDGE): boolean {
  const unsaved = times.filter((t) => t > (mark.lastAt ?? 0));
  if (!unsaved.length) return false;
  const since = Math.max(mark.lastAt ?? 0, mark.laterAt ?? 0);
  const fresh = unsaved.filter((t) => t > since).length;
  const clock = Math.max(since, Math.min(...unsaved));
  return fresh >= rule.works || now - clock >= rule.days * DAY;
}
