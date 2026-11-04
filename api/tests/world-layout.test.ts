import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetData } from './helpers/db.js';
import { testApp } from './helpers/app.js';
import { PW, familyWithChild, png, seedModels, upload } from './helpers/fixtures.js';

const t = testApp();
afterAll(async () => t.close());
beforeEach(async () => { await resetData(t.db); t.mailer.sent.length = 0; await seedModels(t.db, ['M1', 'M2', 'M3', 'M5']); });

describe('가족별 방 동기화', () => {
  it('가족 간 설정이 분리되고 다른 기기의 오래된 버전은 저장하지 않는다', async () => {
    const a = await familyWithChild(t, 'layout-a@test.local');
    const b = await familyWithChild(t, 'layout-b@test.local');
    await request(t.app).get('/v1/family/world-layout').expect(401);
    expect((await a.a.get('/v1/family/world-layout').expect(200)).body).toMatchObject({ exists: false, revision: 0 });
    const secondDevice = request.agent(t.app);
    await secondDevice.post('/v1/auth/login').send({ email: 'layout-a@test.local', password: PW }).expect(204);
    await a.a.put('/v1/family/world-layout').send({ revision: 0, rooms: [4, 7], decor: [] }).expect(200);
    const shared = await secondDevice.get('/v1/family/world-layout').expect(200);
    expect(shared.body).toMatchObject({ exists: true, revision: 1, rooms: [4, 7] });
    expect(shared.headers['cache-control']).toContain('no-store');
    expect((await b.a.get('/v1/family/world-layout').expect(200)).body.exists).toBe(false);
    await secondDevice.put('/v1/family/world-layout').send({ revision: 1, rooms: [4, 7, 8], decor: [] }).expect(200);
    await a.a.put('/v1/family/world-layout').send({ revision: 1, rooms: [9], decor: [] }).expect(409);
    expect((await a.a.get('/v1/family/world-layout')).body.rooms).toEqual([4, 7, 8]);
  });
  it('다른 가족의 작품에 소품을 연결하지 못한다', async () => {
    const a = await familyWithChild(t, 'layout-owner@test.local');
    const b = await familyWithChild(t, 'layout-other@test.local');
    const work = await upload(a.a, a.childId, await png()).expect(202);
    const decor = [{ id: 'one', work: work.body.id, kind: 'plant', spot: 'left' }];
    await b.a.put('/v1/family/world-layout').send({ revision: 0, rooms: [4], decor }).expect(422);
    await a.a.put('/v1/family/world-layout').send({ revision: 0, rooms: [4], decor }).expect(200);
    expect((await a.a.get('/v1/family/world-layout')).body.decor).toEqual(decor);
  });
});
