// US4 시험(T084 결정·T085 이야기·전시·T086 가족 간 차단·T142 동시 수정): UC4·UC5·UC6, FR-6·7·8·9, G9~G12, BR-APR-02~06, BR-EXH-01~07, D2·D3·D11·D14.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetData } from './helpers/db.js';
import { testApp } from './helpers/app.js';
import { familyWithChild, png, seedModels, simulateResult, upload } from './helpers/fixtures.js';

const t = testApp();
afterAll(async () => t.close());
beforeEach(async () => { await resetData(t.db); t.mailer.sent.length = 0; await seedModels(t.db, ['M1', 'M2', 'M3', 'M5']); });
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query(sql, p))[0] as T[];
const STORY = { title: '우리 가족', madeOn: '2026-09-20', ageAtMaking: 5, childWords: '  엄마랑 바다 갔어  ' };

async function reviewed(email: string, kind: 'animated' | 'relief' | 'frame', opts = {}) {
  const f = await familyWithChild(t, email);
  const r = await upload(f.a, f.childId, await png()).expect(202);
  await simulateResult(t.db, r.body.id, kind, opts);
  return { ...f, id: r.body.id as string };
}

describe('결과 확인 결정(UC4)', () => {
  it('움직임+마스크: 좋아요·낮춘 결과로 걸기·액자·다시 찍기, 좋아요 → 승인, 중복은 첫 결정(E7·D11)', async () => {
    const f = await reviewed('d1@test.local', 'animated');
    const d = await f.a.get(`/v1/artworks/${f.id}`).expect(200);
    expect(d.body.choices).toEqual(['like', 'use_lower', 'frame', 'retake']);
    const r = await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'like' }).expect(200);
    expect(r.body).toMatchObject({ alreadyDecided: false, artwork: { state: 'approved', decision: 'like' } });
    const again = await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'frame' }).expect(200);
    expect(again.body.alreadyDecided).toBe(true);
    expect(await q(`SELECT first_decision, in_approval_base FROM artwork_outcome`)).toEqual([{ first_decision: 'like', in_approval_base: 1 }]);
  });
  it('2.5D는 좋아요·액자·다시 찍기, 액자 결과는 좋아요·다시 찍기(UC4 A4)', async () => {
    const r1 = await reviewed('d2@test.local', 'relief');
    expect((await r1.a.get(`/v1/artworks/${r1.id}`)).body.choices).toEqual(['like', 'frame', 'retake']);
    const r2 = await reviewed('d3@test.local', 'frame');
    expect((await r2.a.get(`/v1/artworks/${r2.id}`)).body.choices).toEqual(['like', 'retake']);
  });
  it('낮춘 결과로 걸기 → depth_relief(use_lower)·처리 중·보호자 전환, 2회차에는 use_lower 없음(UC4 A1)', async () => {
    const f = await reviewed('d4@test.local', 'animated');
    const r = await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'use_lower' }).expect(200);
    expect(r.body.artwork.state).toBe('processing');
    expect(await q(`SELECT stage_kind, origin FROM stage_job WHERE origin = 'use_lower'`)).toEqual([{ stage_kind: 'depth_relief', origin: 'use_lower' }]);
    expect((await q<{ result_cause: string }>(`SELECT result_cause FROM artwork_outcome`))[0].result_cause).toBe('guardian_switch');
    await simulateResult(t.db, f.id, 'relief', { origin: 'use_lower' });
    expect((await f.a.get(`/v1/artworks/${f.id}`)).body.choices).toEqual(['like', 'frame', 'retake']);
    await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'like' }).expect(200);
    expect(await q(`SELECT review_round, decision_code FROM decision ORDER BY review_round`)).toEqual([
      { review_round: 1, decision_code: 'use_lower' }, { review_round: 2, decision_code: 'like' }]);
  });
  it('마스크 없으면 use_lower 없음', async () => {
    const f = await reviewed('d5@test.local', 'animated', { mask: false });
    expect((await f.a.get(`/v1/artworks/${f.id}`)).body.choices).toEqual(['like', 'frame', 'retake']);
  });
  it('처리하지 못함: 액자·다시 찍기만, 좋아요는 409(G9), 액자 → 승인·분모 제외·원인 유지(D2)', async () => {
    const f = await familyWithChild(t, 'd6@test.local');
    const r = await upload(f.a, f.childId, await png()).expect(202);
    await t.db.query(`INSERT INTO artwork_outcome (artwork_id, confirmed_path, result_cause) VALUES (?, 'animated', 'not_delivered')`, [r.body.id]);
    await t.db.query(`UPDATE artwork SET status = 'failed' WHERE artwork_id = ?`, [r.body.id]);
    const d = await f.a.get(`/v1/artworks/${r.body.id}`).expect(200);
    expect(d.body).toMatchObject({ state: 'failed', choices: ['frame', 'retake'], notDelivered: { frameAvailable: true } });
    const bad = await f.a.post(`/v1/artworks/${r.body.id}/decision`).send({ decision: 'like' });
    expect(bad.body).toMatchObject({ code: 'conflict', gate: 'G9' });
    await f.a.post(`/v1/artworks/${r.body.id}/decision`).send({ decision: 'frame' }).expect(200);
    expect(await q(`SELECT result_cause, in_approval_base, result_kind FROM artwork_outcome`)).toEqual([{ result_cause: 'not_delivered', in_approval_base: 0, result_kind: 'frame' }]);
  });
  it('다시 찍기 → 삭제 중·deletion_request(retake)·아이 ID 안내(EXT2)', async () => {
    const f = await reviewed('d7@test.local', 'animated');
    const r = await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'retake' }).expect(200);
    expect(r.body.retake).toEqual({ childId: f.childId });
    expect(r.body.artwork).toBeNull();
    expect(await q(`SELECT origin, status FROM deletion_request`)).toEqual([{ origin: 'retake', status: 'waiting_stop' }]);
    expect((await f.a.get(`/v1/artworks/${f.id}`)).status).toBe(404);
  });
});

describe('이야기·전시(UC5·UC6)', () => {
  it('미래 제작일·연령 19는 422(G11), 한마디는 받은 그대로, 부분 저장', async () => {
    const f = await reviewed('s1@test.local', 'animated');
    expect((await f.a.put(`/v1/artworks/${f.id}/story`).send({ madeOn: '2999-01-01' })).body.reason).toBe('made_on_in_future');
    expect((await f.a.put(`/v1/artworks/${f.id}/story`).send({ ageAtMaking: 19 })).status).toBe(422);
    await f.a.put(`/v1/artworks/${f.id}/story`).send({ childWords: STORY.childWords }).expect(200);
    const d = await f.a.put(`/v1/artworks/${f.id}/story`).send({ title: STORY.title }).expect(200);
    expect(d.body.story).toMatchObject({ title: '우리 가족', childWords: '  엄마랑 바다 갔어  ', madeOn: null });
  });
  it('승인 + 필수 이야기 = 전시 중, 전시에는 낮춤 표시 없음, 승인 전은 전시에 없음(BR-EXH-01·07)', async () => {
    const f = await reviewed('s2@test.local', 'relief', { cause: 'model_downgrade' });
    await f.a.put(`/v1/artworks/${f.id}/story`).send(STORY).expect(200);
    expect((await f.a.get(`/v1/gallery?child=${f.childId}`)).body.groups).toEqual([]);
    const r = await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'like' }).expect(200);
    expect(r.body.artwork.state).toBe('exhibited');
    const g = await f.a.get(`/v1/gallery?child=${f.childId}`).expect(200);
    expect(g.body.groups).toHaveLength(1);
    expect(g.body.groups[0]).toMatchObject({ ageAtMaking: 5, items: [{ kind: 'relief', title: '우리 가족', childWords: '  엄마랑 바다 갔어  ' }] });
    expect(JSON.stringify(g.body)).not.toMatch(/downgrade|cause|score/);
    expect((await f.a.put(`/v1/artworks/${f.id}/story`).send({ title: null })).status).toBe(422);
  });
  it('보호자 감상평(D25, BR-STY-04): 선택·원문 그대로 저장, 상세와 전시에 한마디와 따로, 1000자 넘으면 422, 전시 조건 아님', async () => {
    const f = await reviewed('s-note@test.local', 'relief');
    await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'like' }).expect(200);
    await f.a.put(`/v1/artworks/${f.id}/story`).send(STORY).expect(200); // 감상평 없이도 전시
    let g = await f.a.get(`/v1/gallery?child=${f.childId}`).expect(200);
    expect(g.body.groups[0].items[0]).toMatchObject({ childWords: STORY.childWords, guardianNote: null });
    const d0 = await f.a.get(`/v1/artworks/${f.id}`).expect(200);
    const note = '  바다를 처음 본 날의 설렘이 파란 선에 다 담겼어요  ';
    const d = await f.a.put(`/v1/artworks/${f.id}/story`).send({ guardianNote: note, baseUpdatedAt: d0.body.story.updatedAt }).expect(200);
    expect(d.body.story).toMatchObject({ guardianNote: note, childWords: STORY.childWords });
    g = await f.a.get(`/v1/gallery?child=${f.childId}`).expect(200);
    expect(g.body.groups[0].items[0]).toMatchObject({ guardianNote: note, childWords: STORY.childWords });
    expect((await f.a.put(`/v1/artworks/${f.id}/story`).send({ guardianNote: '가'.repeat(1001) })).status).toBe(422);
  });
  it('액자로 걸기면 전시는 원본 액자(SD_03 §19 #17)', async () => {
    const f = await reviewed('s3@test.local', 'animated');
    await f.a.put(`/v1/artworks/${f.id}/story`).send(STORY).expect(200);
    await f.a.post(`/v1/artworks/${f.id}/decision`).send({ decision: 'frame' }).expect(200);
    const g = await f.a.get(`/v1/gallery?child=${f.childId}`).expect(200);
    expect(g.body.groups[0].items[0]).toMatchObject({ kind: 'frame', primaryUrl: null });
    expect(g.body.groups[0].items[0].originalUrl).toMatch(/^\/v1\/files\//);
  });
  it('연령 묶음 → 제작일 순, 제목 찾기', async () => {
    const f = await familyWithChild(t, 's4@test.local');
    for (const [title, madeOn, age] of [['셋', '2026-03-01', 6], ['하나', '2025-05-01', 5], ['둘', '2025-01-01', 5]] as const) {
      const r = await upload(f.a, f.childId, await png()).expect(202);
      await simulateResult(t.db, r.body.id, 'frame');
      await f.a.put(`/v1/artworks/${r.body.id}/story`).send({ title, madeOn, ageAtMaking: age }).expect(200);
      await f.a.post(`/v1/artworks/${r.body.id}/decision`).send({ decision: 'like' }).expect(200);
    }
    const g = await f.a.get(`/v1/gallery?child=${f.childId}`).expect(200);
    expect(g.body.groups.map((x: { ageAtMaking: number; items: { title: string }[] }) => [x.ageAtMaking, x.items.map((i) => i.title)]))
      .toEqual([[5, ['둘', '하나']], [6, ['셋']]]);
    expect((await f.a.get(`/v1/gallery?child=${f.childId}&q=셋`)).body.groups[0].items).toHaveLength(1);
  });
  it('공동 보호자 동시 수정: 오래된 baseUpdatedAt이면 409 story_conflict(T142)', async () => {
    const f = await reviewed('s5@test.local', 'frame');
    await f.a.put(`/v1/artworks/${f.id}/story`).send({ title: '처음' }).expect(200);
    await t.db.query(`UPDATE story SET updated_at = CURRENT_TIMESTAMP - INTERVAL 10 SECOND`);
    const stale = (await f.a.get(`/v1/artworks/${f.id}`)).body.story.updatedAt;
    await f.a.put(`/v1/artworks/${f.id}/story`).send({ title: '먼저 고침', baseUpdatedAt: stale }).expect(200);
    const r = await f.a.put(`/v1/artworks/${f.id}/story`).send({ title: '늦게 고침', baseUpdatedAt: stale });
    expect(r.body).toMatchObject({ code: 'conflict', reason: 'story_conflict' });
  });
});

describe('가족 간 차단(T086, Scenario 12)', () => {
  it('다른 가족의 전시·결정·이야기·파일은 404', async () => {
    const A = await reviewed('x1@test.local', 'animated');
    const B = await familyWithChild(t, 'x2@test.local');
    expect((await B.a.get(`/v1/gallery?child=${A.childId}`)).status).toBe(404);
    expect((await B.a.post(`/v1/artworks/${A.id}/decision`).send({ decision: 'like' })).status).toBe(404);
    expect((await B.a.put(`/v1/artworks/${A.id}/story`).send({ title: 'x' })).status).toBe(404);
    const url = (await A.a.get(`/v1/artworks/${A.id}`)).body.originalUrl;
    expect((await B.a.get(url)).status).toBe(404);
    expect((await request(t.app).get(`/v1/gallery?child=${A.childId}`)).status).toBe(401);
  });
});
