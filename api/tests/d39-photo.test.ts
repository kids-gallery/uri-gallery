// D39 사진 고치기(SD_02 §17-12): 원본은 그대로, 고친 사진을 따로 건다 · 다시 고치면 이전 것은 지운다 · 형식 검사 · 다른 가족 404.
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetData } from './helpers/db.js';
import { testApp } from './helpers/app.js';
import { familyWithChild, jpg, png, seedModels, upload } from './helpers/fixtures.js';

const t = testApp();
afterAll(async () => t.close());
beforeEach(async () => { await resetData(t.db); await seedModels(t.db, ['M1', 'M2', 'M3', 'M5']); });
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query(sql, p))[0] as T[];
const put = (a: Parameters<typeof upload>[0], id: string, buf: Buffer, name = 'fix.jpg') => a.put(`/v1/artworks/${id}/photo`).attach('photo', buf, name);

describe('D39 사진 고치기', () => {
  it('고친 사진이 photoUrl · 전시에 쓰이고 원본은 그대로, 다시 고치면 이전 파일·행은 지운다', async () => {
    const { a, childId } = await familyWithChild(t, 'p1@test.local');
    const r = await upload(a, childId, await png()).expect(202);
    expect(r.body.photoUrl).toBe(r.body.originalUrl);
    const f1 = await put(a, r.body.id, await jpg()).expect(200);
    expect(f1.body).toMatchObject({ photoEdited: true });
    expect(f1.body.photoUrl).not.toBe(f1.body.originalUrl);
    const g = await a.get(`/v1/gallery?child=${childId}`).expect(200);
    expect(g.body.groups[0].items[0].photoUrl).toBe(f1.body.photoUrl);
    const [first] = await q<{ object_key: string }>(`SELECT object_key FROM stored_object WHERE object_kind = 'display'`);
    await put(a, r.body.id, await png(), 'again.png').expect(200);
    const rows = await q<{ object_key: string }>(`SELECT object_key FROM stored_object WHERE object_kind = 'display'`);
    expect(rows).toHaveLength(1);
    expect(fs.existsSync(path.join(t.store, first.object_key))).toBe(false);
    expect((await q(`SELECT * FROM stored_object WHERE object_kind = 'original'`))).toHaveLength(1); // 원본 그대로
  });
  it('형식 밖은 400(G5), 다른 가족은 404', async () => {
    const A = await familyWithChild(t, 'p2@test.local');
    const B = await familyWithChild(t, 'p3@test.local');
    const r = await upload(A.a, A.childId, await png()).expect(202);
    expect((await put(A.a, r.body.id, Buffer.from('hello'), 'x.png')).body.reason).toBe('format');
    expect((await put(B.a, r.body.id, await png())).status).toBe(404);
    expect(await q(`SELECT * FROM stored_object WHERE object_kind = 'display'`)).toEqual([]);
  });
});
