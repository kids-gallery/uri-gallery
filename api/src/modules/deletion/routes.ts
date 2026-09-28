// 삭제 요청 API(T098, UC7, FR-10, G18, BR-ACC-04·BR-DEL-01·05): 보호자만, 202, 목록·전시에서 즉시 빠짐.
import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { withTx } from '../../db/pool.js';
import { guardianAuth } from '../../auth/guards.js';
import { Problem } from '../../lib/problem.js';
import { recordGate } from '../../lib/gateEvent.js';
import { requestArtworkDeletion } from './request.js';

export function deletionRouter(db: Pool): Router {
  const r = Router();
  const auth = guardianAuth(db, { requireFamily: true });
  const fail = async (id: number, kind: 'artwork' | 'child', e: unknown) => {
    if (e instanceof Problem) throw e;
    await recordGate(db, 'G18', kind, id, 'guardian', 'db');
    throw new Problem('not_saved', 'deletion_not_saved', 'G18'); // "삭제되지 않았어요 - 아무것도 바뀌지 않았어요"
  };

  r.delete('/v1/artworks/:id', auth, async (req, res, next) => {
    const id = Number(req.params.id);
    try {
      await withTx(db, async (conn) => {
        const [rows] = await conn.query(`SELECT status FROM artwork WHERE artwork_id = ? AND family_id = ? FOR UPDATE`, [id, req.guardian!.familyId]);
        const a = (rows as { status: string }[])[0];
        if (!a) throw new Problem('not_found');
        if (a.status === 'deleting') return; // 이미 삭제 중 — 같은 202
        await requestArtworkDeletion(conn, id, 'guardian', req.guardian!.accountId);
      }).catch((e) => fail(id, 'artwork', e));
      res.status(202).end();
    } catch (e) { next(e); }
  });

  r.delete('/v1/children/:id', auth, async (req, res, next) => {
    const id = Number(req.params.id);
    try {
      await withTx(db, async (conn) => {
        const [c] = await conn.query(`SELECT child_id FROM child WHERE child_id = ? AND family_id = ? FOR UPDATE`, [id, req.guardian!.familyId]);
        if (!(c as unknown[]).length) throw new Problem('not_found');
        const [open] = await conn.query(`SELECT deletion_id FROM deletion_request WHERE target_kind = 'child' AND child_id = ? AND status NOT IN ('completed','incomplete')`, [id]);
        if ((open as unknown[]).length) return;
        const [arts] = await conn.query(`SELECT artwork_id FROM artwork WHERE child_id = ? AND status <> 'deleting' FOR UPDATE`, [id]);
        for (const a of arts as { artwork_id: number }[]) await requestArtworkDeletion(conn, a.artwork_id, 'guardian', req.guardian!.accountId);
        await conn.query(`INSERT INTO deletion_request (target_kind, origin, child_id, requested_by, status) VALUES ('child', 'guardian', ?, ?, 'waiting_stop')`, [id, req.guardian!.accountId]);
      }).catch((e) => fail(id, 'child', e));
      res.status(202).end();
    } catch (e) { next(e); }
  });
  return r;
}
