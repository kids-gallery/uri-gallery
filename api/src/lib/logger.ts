// 허용 목록 로거(BR-PRV-01, R-17): 이미지·객체 키·자유 입력·이메일·토큰·예외 원문은 남기지 않는다.
import pino from 'pino';

const ALLOWED = new Set([
  'requestId', 'route', 'method', 'status', 'code', 'reason', 'gate', 'stage', 'modelId',
  'modelVersion', 'outcome', 'durationMs', 'event',
]);

const base = pino({ level: process.env.LOG_LEVEL ?? 'info', base: undefined });

function pick(fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (ALLOWED.has(k)) out[k] = v;
  return out;
}

export const log = {
  info: (fields: Record<string, unknown>, msg?: string) => base.info(pick(fields), msg),
  warn: (fields: Record<string, unknown>, msg?: string) => base.warn(pick(fields), msg),
  error: (fields: Record<string, unknown>, msg?: string) => base.error(pick(fields), msg),
};
