// 작품 접수·상세·목록·확정(T061~T063·T078, UC2·UC3, FR-2·3·21, G5·G6·G8·G17, BR-INT-01~05, BR-SUG-03·05, stage-job §2).
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { withTx } from '../../db/pool.js';
import { guardianAuth } from '../../auth/guards.js';
import { Problem, isDup } from '../../lib/problem.js';
import { recordGate } from '../../lib/gateEvent.js';
import { LocalFsDriver, type StoragePort } from '../../storage/LocalFsDriver.js';
import { MAX_BYTES, validateUpload } from './validateUpload.js';
import { JUDGE_MODELS, KIND_MODEL, PRIMARY_MODEL, activeVersions, confirmChoices, type ConfirmKind } from './models.js';
import { artworkDetail, artworkList, type ViewHooks } from './view.js';
import { decide, decisionOptions, type DecisionCode } from './decision.js';
import { saveStory } from './story.js';

const LOCKED = `UTC_TIMESTAMP() + INTERVAL 5 YEAR`; // 판정 전 확정·split 전 judge 잠금(stage-job §2). TIMESTAMP는 2038년까지라 100년은 넘친다

export function artworksRouter(db: Pool, cfg: Config, storage: StoragePort, hooks: ViewHooks = { decisionChoices: (q, id) => decisionOptions(q, storage, id) }): Router {
  const r = Router();
  const auth = guardianAuth(db, { requireFamily: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 5 } });
  const detail = async (familyId: number, id: number) => {
    const d = await artworkDetail(db, cfg, familyId, id, hooks);
    if (!d) throw new Problem('not_found');
    return d;
  };

  // --- 접수(G5·G6): 원본·작품 기록·작업 기록이 모두 저장된 뒤에만 202 ---
  r.post('/v1/artworks', auth, (req, res, next) => {
    upload.single('photo')(req, res, (err: unknown) => {
      if (!err) return next();
      const p = (err as { code?: string })?.code === 'LIMIT_FILE_SIZE'
        ? new Problem('payload_too_large', 'over_20mb', 'G5') : new Problem('invalid_input', 'bad_multipart', 'G5');
      void recordGate(db, 'G5', 'artwork', null, 'guardian', p.reason!).then(() => next(p));
    });
  }, async (req, res, next) => {
    const familyId = req.guardian!.familyId!;
    try {
      const reqNo = z.string().uuid().safeParse(req.header('Idempotency-Key'));
      if (!reqNo.success) {
        await recordGate(db, 'G5', 'artwork', null, 'guardian', 'idempotency_key');
        throw new Problem('invalid_input', 'idempotency_key', 'G5');
      }
      const [dupRows] = await db.query(`SELECT artwork_id FROM artwork WHERE family_id = ? AND request_no = ?`, [familyId, reqNo.data]);
      const existing = (dupRows as { artwork_id: number }[])[0];
      if (existing) return void res.status(202).json(await detail(familyId, existing.artwork_id)); // BR-INT-03

      const childId = Number(req.body?.childId);
      const [c] = await db.query(`SELECT child_id FROM child WHERE child_id = ? AND family_id = ?`, [childId, familyId]);
      if (!(c as unknown[]).length) throw new Problem('not_found');
      let type;
      try { type = await validateUpload(req.file?.buffer); } catch (e) {
        await recordGate(db, 'G5', 'artwork', null, 'guardian', (e as Problem).reason ?? 'invalid');
        throw e;
      }
      const key = LocalFsDriver.newKey(LocalFsDriver.newArtworkPrefix(), 'original', type.ext);
      try { await storage.putNew(key, req.file!.buffer); } catch {
        await recordGate(db, 'G6', 'artwork', null, 'guardian', 'storage');
        throw new Problem('not_saved', 'intake_failed', 'G6');
      }
      let artworkId: number;
      try {
        artworkId = await withTx(db, async (conn) => intakeTx(conn, familyId, childId, reqNo.data, key));
      } catch (e) {
        await storage.delete(key).catch(() => undefined); // 흔적 남기지 않음(FR-2)
        if (isDup(e, 'uq_artwork_request')) {
          const [again] = await db.query(`SELECT artwork_id FROM artwork WHERE family_id = ? AND request_no = ?`, [familyId, reqNo.data]);
          return void res.status(202).json(await detail(familyId, (again as { artwork_id: number }[])[0].artwork_id));
        }
        await recordGate(db, 'G6', 'artwork', null, 'guardian', 'db');
        throw new Problem('not_saved', 'intake_failed', 'G6');
      }
      res.status(202).json(await detail(familyId, artworkId));
    } catch (e) { next(e); }
  });

  r.get('/v1/artworks', auth, async (req, res, next) => {
    try {
      const child = req.query.child ? Number(req.query.child) : undefined;
      res.json(await artworkList(db, cfg, req.guardian!.familyId!, child));
    } catch (e) { next(e); }
  });

  r.get('/v1/artworks/:id', auth, async (req, res, next) => {
    try { res.json(await detail(req.guardian!.familyId!, Number(req.params.id))); } catch (e) { next(e); }
  });

  // --- 확정(G8·G17) ---
  r.post('/v1/artworks/:id/confirm', auth, async (req, res, next) => {
    const familyId = req.guardian!.familyId!;
    const id = Number(req.params.id);
    try {
      const k = z.object({ kind: z.enum(['animated', 'relief', 'frame', 'sculpture']) }).safeParse(req.body);
      if (!k.success) throw new Problem('validation_failed', 'kind', 'G8');
      const kind = k.data.kind as ConfirmKind;
      await withTx(db, async (conn) => {
        const [rows] = await conn.query(`SELECT status FROM artwork WHERE artwork_id = ? AND family_id = ? FOR UPDATE`, [id, familyId]);
        const a = (rows as { status: string }[])[0];
        if (!a || a.status === 'deleting') throw new Problem(a ? 'conflict' : 'not_found', a ? 'deleting' : undefined, 'G8');
        const [oc] = await conn.query(`SELECT confirmed_path FROM artwork_outcome WHERE artwork_id = ?`, [id]);
        const prev = (oc as { confirmed_path: string | null }[])[0]?.confirmed_path;
        if (prev) {
          if (prev === kind) return; // 같은 값 재요청 — 첫 값 유지(200)
          throw new Problem('conflict', 'already_processing', 'G8');
        }
        if (!['received', 'judging', 'awaiting_confirm'].includes(a.status)) throw new Problem('conflict', 'already_processing', 'G8');
        const { choices, unavailable } = await confirmChoices(conn);
        if (!choices.includes(kind)) {
          if (kind === 'sculpture' && !unavailable.some((u) => u.choice === 'sculpture')) throw new Problem('validation_failed', 'sculpture_not_exposed', 'G17');
          throw new Problem('conflict', 'model_disabled', 'G8');
        }
        await confirmTx(conn, cfg, id, kind);
      }).catch(async (e) => {
        if (e instanceof Problem && e.gate) await recordGate(db, e.gate, 'artwork', id, 'guardian', e.reason ?? e.code);
        throw e;
      });
      res.json(await detail(familyId, id));
    } catch (e) { next(e); }
  });

  // --- 결과 확인 결정(G9·G10, UC4) ---
  r.post('/v1/artworks/:id/decision', auth, async (req, res, next) => {
    const familyId = req.guardian!.familyId!;
    const id = Number(req.params.id);
    try {
      const d = z.object({ decision: z.enum(['like', 'use_lower', 'frame', 'retake']) }).safeParse(req.body);
      if (!d.success) throw new Problem('validation_failed', 'decision', 'G10');
      let out;
      try {
        out = await withTx(db, (conn) => decide(db, cfg, storage, conn, familyId, req.guardian!.accountId, id, d.data.decision as DecisionCode));
      } catch (e) {
        if (e instanceof Problem) {
          if (e.gate) await recordGate(db, e.gate, 'artwork', id, 'guardian', e.reason ?? e.code);
          throw e;
        }
        throw new Problem('not_saved', 'decision_not_saved', 'G3'); // UC4 E3
      }
      const artwork = await artworkDetail(db, cfg, familyId, id, hooks);
      res.json({ artwork, alreadyDecided: out.alreadyDecided, ...(out.retakeChildId ? { retake: { childId: String(out.retakeChildId) } } : {}) });
    } catch (e) { next(e); }
  });

  // --- 이야기(G11·G12, UC5, T142) ---
  r.put('/v1/artworks/:id/story', auth, async (req, res, next) => {
    const familyId = req.guardian!.familyId!;
    const id = Number(req.params.id);
    try {
      await withTx(db, (conn) => saveStory(conn, familyId, id, req.body)).catch(async (e) => {
        if (e instanceof Problem) { if (e.gate) await recordGate(db, e.gate, 'artwork', id, 'guardian', e.reason ?? e.code); throw e; }
        throw e;
      });
      res.json(await detail(familyId, id));
    } catch (e) { next(e); }
  });

  return r;
}

/** 접수 트랜잭션(data-model §4): artwork + stored_object(original) + artwork_original + split·judge(또는 제안 없음). */
async function intakeTx(conn: PoolConnection, familyId: number, childId: number, reqNo: string, key: string): Promise<number> {
  const active = await activeVersions(conn);
  const canJudge = JUDGE_MODELS.every((m) => active.has(m));
  const [a] = await conn.query(
    `INSERT INTO artwork (family_id, child_id, request_no, status) VALUES (?, ?, ?, ?)`,
    [familyId, childId, reqNo, canJudge ? 'judging' : 'awaiting_confirm'],
  );
  const artworkId = (a as { insertId: number }).insertId;
  const [so] = await conn.query(
    `INSERT INTO stored_object (owner_kind, family_id, artwork_id, object_kind, object_key) VALUES ('family', ?, ?, 'original', ?)`,
    [familyId, artworkId, key],
  );
  await conn.query(`INSERT INTO artwork_original (artwork_id, object_id) VALUES (?, ?)`, [artworkId, (so as { insertId: number }).insertId]);
  if (canJudge) {
    await conn.query(`INSERT INTO stage_job (artwork_id, stage_kind, origin, serving_group, model_version_id) VALUES (?, 'split', 'intake', 'cpu_vision', ?)`,
      [artworkId, active.get(PRIMARY_MODEL.split)]);
    await conn.query(`INSERT INTO stage_job (artwork_id, stage_kind, origin, serving_group, model_version_id, available_at) VALUES (?, 'judge', 'intake', 'cpu_vision', ?, ${LOCKED})`,
      [artworkId, active.get(PRIMARY_MODEL.judge)]);
  } else {
    // 판정 모델 비활성 — 제안 없이 직접 확정(clarify 2026-09-28, G7)
    await conn.query(`INSERT INTO judgment (artwork_id, suggestion_state) VALUES (?, 'exhausted')`, [artworkId]);
  }
  return artworkId;
}

/** 확정 트랜잭션(data-model §4, stage-job §2·§6). */
async function confirmTx(conn: PoolConnection, cfg: Config, artworkId: number, kind: ConfirmKind) {
  const [jr] = await conn.query(`SELECT split_ok, suggestion, suggestion_state FROM judgment WHERE artwork_id = ?`, [artworkId]);
  const j = (jr as { split_ok: number | null; suggestion: string | null; suggestion_state: string }[])[0];
  const suggestionAtConfirm = !j || j.suggestion_state === 'pending' ? 'before' : j.suggestion_state === 'exhausted' ? 'none' : j.suggestion;
  await conn.query(
    `INSERT INTO artwork_outcome (artwork_id, suggestion_at_confirm, confirmed_path) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE suggestion_at_confirm = VALUES(suggestion_at_confirm), confirmed_path = VALUES(confirmed_path)`,
    [artworkId, suggestionAtConfirm, kind],
  );
  const [pj] = await conn.query(
    `SELECT COUNT(*) n FROM stage_job WHERE artwork_id = ? AND stage_kind IN ('split','judge') AND status IN ('queued','running','retry_wait')`, [artworkId]);
  const judgePending = Number((pj as { n: number }[])[0].n) > 0;
  const active = await activeVersions(conn);

  let stage: string;
  if (kind === 'frame') stage = 'frame_compose';
  else if (kind === 'relief' && !judgePending && j?.split_ok !== 1) stage = 'frame_compose'; // 분리 실패·마스크 없음(stage-job §6)
  else stage = kind === 'animated' ? 'animate_render' : kind === 'relief' ? 'depth_relief' : 'sculpture';

  const model = stage === 'frame_compose' ? null : KIND_MODEL[kind];
  const group = stage === 'depth_relief' ? (cfg.gpuEnabled ? 'gpu' : 'cpu_vision') : stage === 'sculpture' ? 'gpu' : 'cpu_vision';
  const lock = stage !== 'frame_compose' && judgePending;
  await conn.query(
    `INSERT INTO stage_job (artwork_id, stage_kind, origin, serving_group, model_version_id${lock ? ', available_at' : ''})
     VALUES (?, ?, 'confirm', ?, ?${lock ? `, ${LOCKED}` : ''})`,
    [artworkId, stage, group, model ? active.get(model) ?? null : null],
  );
  await conn.query(`UPDATE artwork SET status = 'processing', confirmed_at = CURRENT_TIMESTAMP WHERE artwork_id = ?`, [artworkId]);
}
