// 작품 응답 조립(T062, contracts ArtworkDetail·ArtworkSummary). 전시 여부는 v_artwork_display 한 곳(G12),
// 점수·객체 키·모델 이름은 싣지 않는다(BR-SUG-02, BR-PRV-01). 파일은 짧게 유효한 토큰 주소로만.
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { Config } from '../../config.js';
import { signFileToken } from '../files/token.js';
import { confirmChoices, sculptureExposed } from './models.js';

type Q = Pool | PoolConnection;
const STAGE_STATUS: Record<string, string> = {
  queued: 'waiting', retry_wait: 'retrying', running: 'running', done: 'done', done_downgraded: 'done', failed: 'failed', cancelled: 'cancelled',
};
const CONFIRM_STATES = new Set(['received', 'judging', 'awaiting_confirm']);
const RESULT_STAGES = new Set(['animate_render', 'depth_relief', 'sculpture', 'frame_compose']);

export interface ViewHooks { decisionChoices?: (db: Q, artworkId: number) => Promise<{ choices: string[]; unavailable: { choice: string; reason: string }[] }> }

const one = async <T>(db: Q, sql: string, p: unknown[]) => ((await db.query(sql, p))[0] as T[])[0];
const all = async <T>(db: Q, sql: string, p: unknown[]) => (await db.query(sql, p))[0] as T[];

export async function artworkDetail(db: Q, cfg: Config, familyId: number, artworkId: number, hooks: ViewHooks = {}) {
  const a = await one<{ artwork_id: number; child_id: number; status: string; display_status: string }>(db,
    `SELECT artwork_id, child_id, status, display_status FROM v_artwork_display WHERE artwork_id = ? AND family_id = ?`, [artworkId, familyId]);
  if (!a || a.status === 'deleting') return null;
  const url = (objectId: number | null | undefined) => (objectId ? `/v1/files/${signFileToken(cfg.sessionSecret, Number(objectId), familyId)}` : null);

  const orig = await one<{ object_id: number }>(db, `SELECT object_id FROM artwork_original WHERE artwork_id = ?`, [artworkId]);
  const j = await one<{ cutout_object_id: number | null; suggestion: string | null; suggestion_state: string }>(db,
    `SELECT cutout_object_id, suggestion, suggestion_state FROM judgment WHERE artwork_id = ?`, [artworkId]);
  const oc = await one<{ confirmed_path: string | null }>(db, `SELECT confirmed_path FROM artwork_outcome WHERE artwork_id = ?`, [artworkId]);
  const jobs = await all<{ stage_kind: string; status: string; attempt_count: number; downgrade_cause: string | null }>(db,
    `SELECT stage_kind, status, attempt_count, downgrade_cause FROM v_job_progress WHERE artwork_id = ? ORDER BY job_id`, [artworkId]);
  const cr = await one<{ result_kind: string; object_id: number | null }>(db, `SELECT result_kind, object_id FROM v_current_result WHERE artwork_id = ?`, [artworkId]);
  const dec = await one<{ decision_code: string }>(db, `SELECT decision_code FROM decision WHERE artwork_id = ? ORDER BY review_round DESC LIMIT 1`, [artworkId]);
  const st = await one<{ title: string | null; made_on: Date | null; age_at_creation: number | null; utterance: string | null; updated_at: Date }>(db,
    `SELECT title, made_on, age_at_creation, utterance, updated_at FROM story WHERE artwork_id = ?`, [artworkId]);

  let choices: string[] = [];
  let unavailable: { choice: string; reason: string }[] = [];
  if (CONFIRM_STATES.has(a.status) && !oc?.confirmed_path) {
    const c = await confirmChoices(db);
    choices = c.choices;
    unavailable = c.unavailable;
  } else if ((a.status === 'awaiting_review' || a.status === 'failed') && hooks.decisionChoices) {
    const c = await hooks.decisionChoices(db, artworkId);
    choices = c.choices;
    unavailable = c.unavailable;
  }

  let result = null;
  if (cr) {
    const exposedOff = cr.result_kind === 'sculpture' && !(await sculptureExposed(db));
    const kind = exposedOff ? 'frame' : cr.result_kind; // D10
    result = {
      kind,
      primaryUrl: kind === 'frame' ? null : url(cr.object_id),
      auxUrl: kind === 'relief' ? url(j?.cutout_object_id) : null,
      posterUrl: null,
    };
  }
  const downgrade = [...jobs].reverse().find((x) => RESULT_STAGES.has(x.stage_kind) && x.status === 'done_downgraded' && x.downgrade_cause)?.downgrade_cause
    ?? jobs.find((x) => x.stage_kind === 'split' && x.downgrade_cause === 'split_fail' && oc?.confirmed_path === 'relief' && cr?.result_kind === 'frame')?.downgrade_cause
    ?? null;

  return {
    id: String(a.artwork_id),
    childId: String(a.child_id),
    state: a.display_status,
    queued: a.status === 'judging' && jobs.some((x) => x.stage_kind === 'judge' && x.status === 'queued'),
    originalUrl: url(orig?.object_id),
    cutoutUrl: url(j?.cutout_object_id),
    suggestion: j?.suggestion_state === 'presented' ? j.suggestion : j?.suggestion_state === 'exhausted' ? 'none' : null,
    confirmedKind: oc?.confirmed_path ?? null,
    choices,
    unavailableChoices: unavailable,
    stages: jobs.map((x) => ({ stage: x.stage_kind, status: STAGE_STATUS[x.status] ?? x.status, attempt: Number(x.attempt_count), downgraded: x.status === 'done_downgraded', waitingForModel: false, etaSeconds: null })),
    result,
    downgrade: result ? downgrade : null,
    notDelivered: a.status === 'failed' ? { frameAvailable: Boolean(orig) } : undefined,
    decision: dec?.decision_code ?? null,
    story: {
      title: st?.title ?? null,
      madeOn: st?.made_on ? new Date(st.made_on).toISOString().slice(0, 10) : null,
      ageAtMaking: st?.age_at_creation ?? null,
      childWords: st?.utterance ?? null,
      updatedAt: st?.updated_at ? new Date(st.updated_at).toISOString() : null,
    },
    caption: null,
    tagCandidates: [] as string[],
  };
}

export async function artworkList(db: Q, cfg: Config, familyId: number, childId?: number) {
  const rows = await all<{ artwork_id: number; child_id: number; display_status: string; title: string | null; received_at: Date; obj: number | null }>(db,
    `SELECT d.artwork_id, d.child_id, d.display_status, s.title, a.received_at,
            COALESCE(j.cutout_object_id, ao.object_id) obj
       FROM v_artwork_display d JOIN artwork a ON a.artwork_id = d.artwork_id
       LEFT JOIN story s ON s.artwork_id = d.artwork_id
       LEFT JOIN judgment j ON j.artwork_id = d.artwork_id
       LEFT JOIN artwork_original ao ON ao.artwork_id = d.artwork_id
      WHERE d.family_id = ? AND d.status <> 'deleting' ${childId ? 'AND d.child_id = ?' : ''}
      ORDER BY a.received_at DESC, d.artwork_id DESC`,
    childId ? [familyId, childId] : [familyId]);
  const cur = await all<{ artwork_id: number; stage_kind: string }>(db,
    `SELECT artwork_id, stage_kind FROM stage_job WHERE artwork_id IN (SELECT artwork_id FROM artwork WHERE family_id = ?)
       AND status IN ('queued','running','retry_wait') ORDER BY job_id`, [familyId]);
  const stageOf = new Map<number, string>();
  for (const c of cur) if (!stageOf.has(Number(c.artwork_id))) stageOf.set(Number(c.artwork_id), c.stage_kind); // 가장 먼저 등록된 진행 중 작업
  return rows.map((r) => ({
    id: String(r.artwork_id), childId: String(r.child_id), state: r.display_status,
    currentStage: stageOf.get(Number(r.artwork_id)) ?? null, title: r.title,
    thumbnailUrl: r.obj ? `/v1/files/${signFileToken(cfg.sessionSecret, Number(r.obj), familyId)}` : null,
    updatedAt: new Date(r.received_at).toISOString(),
  }));
}
