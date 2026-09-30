// RFC 9457 Problem Details + code (research R-10, contracts/openapi.yaml Problem).
// 트리거 SIGNAL MESSAGE_TEXT("G11 BR-STY-02 made_on_in_future" 형식)를 게이트·사유 코드로 바꾼다(data-model §5).
export type ProblemCode =
  | 'unauthorized' | 'forbidden_role' | 'not_found' | 'conflict' | 'invalid_input'
  | 'payload_too_large' | 'validation_failed' | 'not_saved' | 'llm_unavailable'
  | 'token_invalid' | 'email_unverified' | 'rate_limited';

const STATUS: Record<ProblemCode, number> = {
  unauthorized: 401, forbidden_role: 403, not_found: 404, conflict: 409, invalid_input: 400,
  payload_too_large: 413, validation_failed: 422, not_saved: 503, llm_unavailable: 503,
  token_invalid: 400, email_unverified: 403, rate_limited: 429,
};

export class Problem extends Error {
  readonly status: number;
  constructor(
    readonly code: ProblemCode,
    readonly reason?: string,
    readonly gate?: string,
    readonly fields?: { name: string; reason: string }[],
    status?: number,
  ) {
    super(reason ?? code);
    this.status = status ?? STATUS[code];
  }
  body(requestId?: string) {
    return {
      type: `about:blank#${this.code}`,
      title: this.code,
      status: this.status,
      code: this.code,
      ...(this.reason ? { reason: this.reason } : {}),
      ...(this.gate ? { gate: this.gate } : {}),
      ...(this.fields ? { fields: this.fields } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }
}

/** zod 검사 실패 → 계약 fields(JSON 본문 공통 오류, 계약 머리말). 모르는 칸은 칸마다 reason 'unrecognized'. */
export function zodFields(err: { issues: { code: string; path: (string | number)[]; message: string; keys?: string[] }[] }): { name: string; reason: string }[] {
  return err.issues.flatMap((i) => (i.code === 'unrecognized_keys'
    ? (i.keys ?? []).map((k) => ({ name: k, reason: 'unrecognized' }))
    : [{ name: String(i.path[0] ?? ''), reason: i.code === 'custom' ? i.message : i.code }]));
}

/** 트리거가 SIGNAL SQLSTATE '45000'으로 거절한 경우 {gate, reason}을 뽑는다. 아니면 null. */
export function parseSignal(err: unknown): { gate?: string; reason: string } | null {
  const e = err as { sqlState?: string; sqlMessage?: string };
  if (e?.sqlState !== '45000' || !e.sqlMessage) return null;
  const parts = e.sqlMessage.trim().split(/\s+/);
  const gate = parts.find((p) => /^G\d{1,2}$/.test(p));
  const reason = parts[parts.length - 1];
  return { gate, reason };
}

/** 유일 제약 위반(ER_DUP_ENTRY)인가 — 제약 이름으로 가린다. */
export function isDup(err: unknown, key?: string): boolean {
  const e = err as { code?: string; sqlMessage?: string };
  return e?.code === 'ER_DUP_ENTRY' && (!key || (e.sqlMessage ?? '').includes(key));
}
