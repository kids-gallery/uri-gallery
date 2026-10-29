// 사용 기록(3D미술관_재설계 §2-22 11, 설계도 8-2): 가족마다 기기 안에 숫자만 둔다. 사진·글·이름은 넣지 않고 밖으로 보내지 않는다.
export interface Usage { uploads: number; plays: number; shares: number; days: number; lastDay: number }
export type UsageKind = 'uploads' | 'plays' | 'shares';
export const EMPTY_USAGE: Usage = { uploads: 0, plays: 0, shares: 0, days: 0, lastDay: 0 };

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
/** 저장된 값을 읽을 때 숫자 칸만 남긴다(다른 칸이 섞여 있어도 버린다) */
export function normalizeUsage(v: unknown): Usage {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { uploads: count(o.uploads), plays: count(o.plays), shares: count(o.shares), days: count(o.days), lastDay: count(o.lastDay) };
}
export const bump = (u: Usage, kind: UsageKind, n = 1): Usage => ({ ...u, [kind]: u[kind] + Math.max(0, Math.floor(n)) });
/** 'YYYY-MM-DD' → YYYYMMDD 숫자. 날짜도 숫자로만 둔다 */
export const dayNumber = (ymd: string) => Number(ymd.replace(/-/g, '')) || 0;
/** 들어온 날 수: 오늘이 마지막으로 센 날과 다를 때만 하루 더한다 */
export function visit(u: Usage, today: number): Usage {
  return u.lastDay === today ? u : { ...u, days: u.days + 1, lastDay: today };
}
