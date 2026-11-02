// #21 시험: 컨테이너 배치용 설정(SD_04 4-3) — 바인딩 주소, 프록시 신뢰 범위(요청 한도가 사용자 주소로), 비밀 값 파일.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { testApp } from './helpers/app.js';

const PW = 'correct horse battery 9';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uam-secret-'));
const file = (name: string, body: string) => { const p = path.join(dir, name); fs.writeFileSync(p, body); return p; };

describe('바인딩 주소·프록시 신뢰 범위', () => {
  it('기본값은 지금 값(127.0.0.1, loopback), 비운 값도 기본값', () => {
    expect(loadConfig({})).toMatchObject({ host: '127.0.0.1', trustProxy: 'loopback' });
    expect(loadConfig({ APP_HOST: '', TRUST_PROXY: '' })).toMatchObject({ host: '127.0.0.1', trustProxy: 'loopback' });
  });
  it('compose 값을 그대로 받는다', () => {
    expect(loadConfig({ APP_HOST: '0.0.0.0', TRUST_PROXY: 'uniquelocal' })).toMatchObject({ host: '0.0.0.0', trustProxy: 'uniquelocal' });
  });
});

describe('요청 한도는 믿는 입구 뒤의 사용자 주소로 건다', () => {
  // 시험 요청은 127.0.0.1에서 온다. 사용자 두 명이 같은 입구를 지나 가입한 경우 IP 기록이 몇 개로 남는지 본다.
  async function ipSubjects(env: Record<string, string>) {
    const t = testApp(env);
    try {
      await t.db.query(`DELETE FROM auth_rate_event WHERE action = 'signup'`);
      for (const [n, ip] of [[1, '203.0.113.1'], [2, '203.0.113.2']] as const) {
        await request(t.app).post('/v1/auth/signup').set('X-Forwarded-For', ip)
          .send({ email: `proxy${n}-${Date.now()}@test.local`, password: PW, passwordConfirm: PW }).expect(202);
      }
      const [rows] = await t.db.query(`SELECT COUNT(DISTINCT subject_hash) AS n FROM auth_rate_event WHERE action = 'signup' AND subject_type = 'ip'`);
      return Number((rows as { n: number }[])[0]!.n);
    } finally { await t.close(); }
  }
  it('입구를 믿으면 사용자마다 따로 센다', async () => {
    expect(await ipSubjects({})).toBe(2);                              // 기본 loopback: 같은 PC의 nginx
    expect(await ipSubjects({ TRUST_PROXY: '127.0.0.1/8' })).toBe(2);  // 주소 범위로 준 값도
  });
  it('입구를 믿지 않으면 모든 사용자가 입구 주소 하나로 묶인다(고치기 전 컨테이너의 상태)', async () => {
    expect(await ipSubjects({ TRUST_PROXY: 'uniquelocal' })).toBe(1);
  });
});

describe('비밀 값 파일(compose secrets)', () => {
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
  it('_FILE이 있으면 파일에서 읽고 끝 줄바꿈 하나를 뺀다. 환경 변수보다 먼저', () => {
    const c = loadConfig({
      DB_PASSWORD_FILE: file('db', 'db-pw\n'), DB_PASSWORD: 'env-pw',
      SESSION_SECRET_FILE: file('session', 's3cret\r\n'), AUTH_HMAC_SECRET_FILE: file('hmac', 'hmac  '),
    });
    expect([c.db.password, c.sessionSecret, c.authHmacSecret]).toEqual(['db-pw', 's3cret', 'hmac  ']);
  });
  it('_FILE이 없으면 지금처럼 환경 변수', () => {
    const c = loadConfig({ DB_PASSWORD: 'env-pw', SESSION_SECRET: 's', AUTH_HMAC_SECRET: 'h' });
    expect([c.db.password, c.sessionSecret, c.authHmacSecret]).toEqual(['env-pw', 's', 'h']);
  });
  it('파일을 못 읽으면 기동을 멈춘다(빈 값으로 뜨지 않게)', () => {
    expect(() => loadConfig({ SESSION_SECRET_FILE: path.join(dir, 'none') })).toThrow(/ENOENT/);
  });
});
