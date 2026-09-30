// 부모 댓글(D46 ④, SD_02 §17-14): 가족 보호자(공동 보호자 포함)만 읽고 쓴다. 500자, 입력 그대로. 자기 댓글만 지운다.
// 가족 밖(이웃 방문, D40)에는 이 경로가 없다 — 가족 확인은 artwork.family_id로.
import type { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { Problem } from '../../lib/problem.js';
import type { RequestHandler } from 'express';

const bodySchema = z.object({ body: z.string().max(500) }).strict();

async function own(db: Pool, familyId: number, id: number) {
  const [r] = await db.query(`SELECT status FROM artwork WHERE artwork_id = ? AND family_id = ?`, [id, familyId]);
  const a = (r as { status: string }[])[0];
  if (!a || a.status === 'deleting') throw new Problem('not_found');
}
const view = (c: { comment_id: number; body: string; created_at: Date; account_id: number | null; role: string | null }, me: number) => ({
  id: String(c.comment_id), body: c.body, createdAt: new Date(c.created_at).toISOString(),
  mine: c.account_id === me, author: c.account_id === me ? 'me' : c.role === 'owner' ? 'owner' : c.role === 'co' ? 'co' : 'gone',
});

export function mountComments(r: Router, db: Pool, auth: RequestHandler) {
  r.get('/v1/artworks/:id/comments', auth, async (req, res, next) => {
    try {
      const g = req.guardian!; const id = Number(req.params.id);
      await own(db, g.familyId!, id);
      const [rows] = await db.query(
        `SELECT c.comment_id, c.body, c.created_at, c.account_id, ga.role FROM artwork_comment c
           LEFT JOIN guardian_account ga ON ga.account_id = c.account_id WHERE c.artwork_id = ? ORDER BY c.created_at, c.comment_id`, [id]);
      res.json((rows as Parameters<typeof view>[0][]).map((c) => view(c, g.accountId)));
    } catch (e) { next(e); }
  });
  r.post('/v1/artworks/:id/comments', auth, async (req, res, next) => {
    try {
      const g = req.guardian!; const id = Number(req.params.id);
      const b = bodySchema.safeParse(req.body);
      if (!b.success) throw new Problem('validation_failed', 'invalid_fields', undefined, b.error.issues.map((i) => ({ name: String(i.path[0] ?? 'body'), reason: i.code })));
      if (!b.data.body.trim()) throw new Problem('validation_failed', 'comment_blank', undefined, [{ name: 'body', reason: 'blank' }]);
      await own(db, g.familyId!, id);
      const [ins] = await db.query(`INSERT INTO artwork_comment (artwork_id, account_id, body) VALUES (?, ?, ?)`, [id, g.accountId, b.data.body]);
      const [rows] = await db.query(`SELECT comment_id, body, created_at, account_id, ? role FROM artwork_comment WHERE comment_id = ?`, [g.role, (ins as { insertId: number }).insertId]);
      res.status(201).json(view((rows as Parameters<typeof view>[0][])[0]!, g.accountId));
    } catch (e) { next(e); }
  });
  r.delete('/v1/artworks/:id/comments/:commentId', auth, async (req, res, next) => {
    try {
      const g = req.guardian!; const id = Number(req.params.id);
      await own(db, g.familyId!, id);
      const [rows] = await db.query(`SELECT account_id FROM artwork_comment WHERE comment_id = ? AND artwork_id = ?`, [Number(req.params.commentId), id]);
      const c = (rows as { account_id: number | null }[])[0];
      if (!c) throw new Problem('not_found');
      if (c.account_id !== g.accountId) throw new Problem('forbidden_role', 'not_your_comment');
      await db.query(`DELETE FROM artwork_comment WHERE comment_id = ?`, [Number(req.params.commentId)]);
      res.status(204).end();
    } catch (e) { next(e); }
  });
}
