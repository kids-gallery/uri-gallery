// Raw structured-log value boundary (#103). New routes/events require review.
import { createHash } from 'node:crypto';
const ROUTES = new Set<string>(["/live", "/metrics", "/openapi.json", "/ready", "/v1/admin/api-guide/spec", "/v1/admin/api-guide/test-call", "/v1/admin/api-guide/test-call/:jobId", "/v1/admin/eval-items", "/v1/admin/eval-runs/:runId", "/v1/admin/metrics", "/v1/admin/models", "/v1/admin/models/:mid/deactivate", "/v1/admin/models/:mid/evaluate", "/v1/admin/models/:mid/promote", "/v1/admin/models/:mid/rollback", "/v1/admin/models/:mid/versions", "/v1/admin/unreached", "/v1/artworks", "/v1/artworks/:id", "/v1/artworks/:id/captions", "/v1/artworks/:id/captions/:cid", "/v1/artworks/:id/comments", "/v1/artworks/:id/comments/:commentId", "/v1/artworks/:id/confirm", "/v1/artworks/:id/decision", "/v1/artworks/:id/deletion", "/v1/artworks/:id/story", "/v1/auth/email/verify", "/v1/auth/email/verify/resend", "/v1/auth/kakao/callback", "/v1/auth/kakao/start", "/v1/auth/login", "/v1/auth/logout", "/v1/auth/password", "/v1/auth/providers", "/v1/auth/recovery", "/v1/auth/recovery/reset", "/v1/auth/signup", "/v1/captions/model-status", "/v1/children", "/v1/children/:childId", "/v1/children/:id", "/v1/children/:id/deletion", "/v1/family", "/v1/family/invites", "/v1/family/invites/:id", "/v1/family/invites/accept", "/v1/family/invites/lookup", "/v1/family/leave", "/v1/family/members", "/v1/family/members/:id", "/v1/files/:token", "/v1/gallery", "/v1/me", "/v1/neighbors", "/v1/neighbors/:buildingId", "/v1/neighbors/accept", "/v1/neighbors/invites", "/v1/neighbors/invites/:inviteId", "/v1/ops/auth/login", "/v1/ops/auth/logout", "/v1/ops/me", "/v1/ops/model-checks", "/v1/ops/model-checks/:checkId", "/v1/ops/models", "/v1/ops/models/:id/check", "/v1/ops/models/:id/warmup", "/v1/town", "/v1/visit/children/:childId/gallery", "/v1/visit/files/:token", "unmatched"]);
const EVENTS = new Set<string>(["unknown", "listening", "mail_sent", "mail_failed", "mail_disabled", "kakao_invite_invalid", "kakao_invite_in_family", "kakao_invite_full", "kakao_invite_joined", "kakao_login", "kakao_signup", "kakao_cancelled", "kakao_failed", "sweep_takeover_failed", "sweep_takeover_external_failed", "sweep_deletion_failed", "sweep_housekeeping_failed"]);
const CODES = new Set<string>(["unknown", "internal", "error", "verify", "already_registered", "recovery", "invite", "access_denied", "state", "race", "db", "kakao_token", "kakao_profile", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT", "PROTOCOL_CONNECTION_LOST"]);

export const logRequestId = (value: string) => 'rid_' + createHash('sha256').update(value).digest('hex');
export function safeLogFields(fields: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k,v] of Object.entries(fields)) {
    if (k === 'requestId' && typeof v === 'string' && v.length <= 1024) out[k] = logRequestId(v);
    if (k === 'route' && typeof v === 'string') out[k] = ROUTES.has(v) ? v : 'unmatched';
    if (k === 'method' && ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(v as string)) out[k] = v;
    if (k === 'status' && Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 65535) out[k] = v;
    if (k === 'durationMs' && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    if (k === 'event' && typeof v === 'string') out[k] = EVENTS.has(v) ? v : 'unknown';
    if (k === 'code' && typeof v === 'string') out[k] = CODES.has(v) ? v : 'unknown';
  }
  return out;
}
