import sharp from 'sharp';
import request from 'supertest';
import type { Pool } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { tokenOf } from './app.js';

export const PW = 'correct-horse-1';
export const png = () => sharp({ create: { width: 32, height: 32, channels: 3, background: '#88aaee' } }).png().toBuffer();
export const jpg = () => sharp({ create: { width: 32, height: 32, channels: 3, background: '#ee8844' } }).jpeg().toBuffer();

/** 가입·확인한 보호자 agent와 아이 하나 */
export async function familyWithChild(t: { app: import("node:http").Server; mailer: { sent: { link?: string }[] } }, email: string) {
  await request(t.app).post('/v1/auth/signup').send({ email, password: PW, passwordConfirm: PW }).expect(202);
  const a = request.agent(t.app);
  await a.post('/v1/auth/email/verify').send({ token: tokenOf(t.mailer.sent.at(-1)!.link) }).expect(204);
  const c = await a.post('/v1/children').send({ alias: '하늘' }).expect(201);
  return { a, childId: c.body.id as string };
}

/** 모델 버전 시드: 활성(라이선스 확인)으로 둘 모델 목록 */
export async function seedModels(db: Pool, activeModels: string[]) {
  await db.query('DELETE FROM model_version');
  let id = 100;
  for (const m of ['M1', 'M2', 'M3', 'M5', 'M6', 'M7']) {
    const on = activeModels.includes(m);
    await db.query(`INSERT INTO model_version (version_id, model_id, version_label, weights_sha256, config_hash, license_confirmed, release_state)
                    VALUES (?, ?, 'v1', REPEAT('a',64), REPEAT('b',64), ?, ?)`, [id++, m, on, on ? 'active' : 'candidate']);
  }
}

export const upload = (a: ReturnType<typeof request.agent>, childId: string, buf: Buffer, key = randomUUID(), name = 'p.png') =>
  a.post('/v1/artworks').set('Idempotency-Key', key).field('childId', childId).attach('photo', buf, name);
