// 아이 API(T051, UC1, FR-1 v2.2, BR-CHD-01·02, G4). 별칭만 받는다. 별칭은 앞뒤 공백 뺀 1~20자(D22, T149). 중복 검사 없음 — 같으면 저장하고 aliasDuplicate로 안내(D18).
// 다른 가족 아이는 404로 존재를 숨긴다(G0). 삭제는 US5(deletion 모듈).
import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { guardianAuth } from '../../auth/guards.js';
import { Problem, zodFields } from '../../lib/problem.js';
import { recordGate } from '../../lib/gateEvent.js';

const aliasSchema = z.object({ alias: z.string() }).strict();

function cleanAlias(body: unknown): string {
  const r = aliasSchema.safeParse(body); // 실명·생년월일 같은 다른 필드는 받지 않는다(BR-CHD-01)
  if (!r.success) throw new Problem('validation_failed', 'invalid_fields', 'G4', zodFields(r.error));
  const alias = r.data.alias.trim();
  if (!alias) throw new Problem('validation_failed', 'alias_blank', 'G4', [{ name: 'alias', reason: 'blank' }]);
  if ([...alias].length > 20) throw new Problem('validation_failed', 'alias_too_long', 'G4', [{ name: 'alias', reason: 'too_long' }]);
  return alias;
}

export function childrenRouter(db: Pool): Router {
  const r = Router();
  const auth = guardianAuth(db, { requireFamily: true });

  const duplicated = async (familyId: number, alias: string, exceptId?: number) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) n FROM child WHERE family_id = ? AND alias = ? AND child_id <> ?`, [familyId, alias, exceptId ?? 0]);
    return Number((rows as { n: number }[])[0].n) > 0;
  };

  r.get('/v1/children', auth, async (req, res, next) => {
    try {
      const [rows] = await db.query(
        `SELECT v.child_id, v.alias, v.artwork_count FROM v_child_artwork_count v
          WHERE v.family_id = ? AND NOT EXISTS (SELECT 1 FROM deletion_request d WHERE d.target_kind = 'child' AND d.child_id = v.child_id AND d.status NOT IN ('completed','incomplete'))
          ORDER BY v.child_id`,
        [req.guardian!.familyId],
      );
      res.json((rows as { child_id: number; alias: string; artwork_count: number }[])
        .map((c) => ({ id: String(c.child_id), alias: c.alias, artworkCount: Number(c.artwork_count) })));
    } catch (e) { next(e); }
  });

  r.post('/v1/children', auth, async (req, res, next) => {
    try {
      let alias: string;
      try { alias = cleanAlias(req.body); } catch (e) {
        await recordGate(db, 'G4', 'child', null, 'guardian', (e as Problem).reason ?? 'invalid');
        throw e;
      }
      const familyId = req.guardian!.familyId!;
      const dup = await duplicated(familyId, alias);
      let id: number;
      try {
        const [ins] = await db.query(`INSERT INTO child (family_id, alias) VALUES (?, ?)`, [familyId, alias]);
        id = (ins as { insertId: number }).insertId;
      } catch { throw new Problem('not_saved', 'child_not_saved', 'G3'); }
      res.status(201).json({ id: String(id), alias, artworkCount: 0, aliasDuplicate: dup });
    } catch (e) { next(e); }
  });

  r.patch('/v1/children/:childId', auth, async (req, res, next) => {
    try {
      const alias = cleanAlias(req.body);
      const familyId = req.guardian!.familyId!;
      const id = Number(req.params.childId);
      const [upd] = await db.query(`UPDATE child SET alias = ?, updated_at = CURRENT_TIMESTAMP WHERE child_id = ? AND family_id = ?`, [alias, id, familyId]);
      if ((upd as { affectedRows: number }).affectedRows === 0) throw new Problem('not_found');
      const [rows] = await db.query(`SELECT artwork_count FROM v_child_artwork_count WHERE child_id = ?`, [id]);
      res.json({ id: String(id), alias, artworkCount: Number((rows as { artwork_count: number }[])[0]?.artwork_count ?? 0), aliasDuplicate: await duplicated(familyId, alias, id) });
    } catch (e) { next(e); }
  });

  return r;
}
