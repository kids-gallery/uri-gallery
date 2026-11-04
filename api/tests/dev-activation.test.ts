// #33: 개발용 최초 활성은 기존 버전을 보존하고 재실행해도 중복하지 않는다.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { activateDevModels, realVersions } from '../scripts/migrate.js';
import { resetData, testPool } from './helpers/db.js';

describe('개발용 모델 최초 활성', () => {
  let db: Pool;
  let conn: PoolConnection;
  beforeAll(async () => {
    db = testPool();
    conn = await db.getConnection();
    await resetData(db); // 시험 파일들이 임시 DB를 함께 쓴다. 앞 파일의 stage_job이 남아 있으면 model_version을 지우지 못한다
  });
  afterAll(async () => {
    await conn.query('DELETE FROM model_version');
    conn.release();
    await db.end();
  });

  const active = async () => {
    const [rows] = await conn.query(`SELECT model_id, runtime, weights_sha256, config_hash, exec_device, license_confirmed
      FROM model_version WHERE release_state = 'active' ORDER BY model_id`);
    return rows as { model_id: string; runtime: string; weights_sha256: string; config_hash: string; exec_device: string }[];
  };
  const manifest = (body: string) => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'manifest-')), 'manifest.yaml');
    writeFileSync(file, body);
    return file;
  };
  const ok = (id: string, c: string, runtime: string, extra = 'license_confirmed: true') =>
    `  ${id}: {weights_sha256: ${c.repeat(64)}, config_hash: ${c.repeat(64)}, runtime: ${runtime}, ${extra}}\n`;

  it('가짜로 켠 볼륨에서 실제로 바꾸면 행이 매니페스트 값이 되고 다시 끄면 가짜로 돌아간다', async () => {
    await conn.query('DELETE FROM model_version');
    await activateDevModels(conn);
    const file = manifest(`models:\n${ok('M1', 'a', 'torch-2.4.1-cpu')}${ok('M2', 'b', 'open_clip-2.26.1-mps')}${ok('M5', 'c', 'torch-2.4.1-mps')}`);
    const real = realVersions(['M1', 'M2', 'M5'], file);
    await activateDevModels(conn, real);
    await activateDevModels(conn, real);
    expect(await active()).toMatchObject([
      { model_id: 'M1', runtime: 'torch-2.4.1-cpu', weights_sha256: 'a'.repeat(64), config_hash: 'a'.repeat(64), exec_device: 'cpu' },
      { model_id: 'M2', runtime: 'open_clip-2.26.1-cpu', weights_sha256: 'b'.repeat(64) },
      { model_id: 'M3', runtime: 'fake' },
      { model_id: 'M5', runtime: 'torch-2.4.1-cpu', weights_sha256: 'c'.repeat(64) },
    ]);
    const [all] = await conn.query(`SELECT COUNT(*) AS n FROM model_version`);
    expect((all as { n: number }[])[0]!.n).toBe(7); // 재실행으로 행이 늘지 않는다
    await activateDevModels(conn);
    expect((await active()).map((v) => v.runtime)).toEqual(['fake', 'fake', 'fake', 'fake']);
  });

  it('자체 모델 매니페스트로 바꾸면 같은 볼륨에서 그 해시가 활성이 된다', async () => {
    await conn.query('DELETE FROM model_version');
    await activateDevModels(conn, realVersions(['M1'], manifest(`models:\n${ok('M1', 'a', 'torch-2.4.1-cpu')}`)));
    await activateDevModels(conn, realVersions(['M1'], manifest(`models:\n${ok('M1', 'd', 'torch-2.4.1-cpu')}`)));
    expect((await active()).find((v) => v.model_id === 'M1')).toMatchObject({ weights_sha256: 'd'.repeat(64) });
  });

  const human = (w: string, c: string, runtime: string, id = 'M1', label = 'v1') => conn.query(`INSERT INTO model_version
      (model_id, version_label, weights_sha256, config_hash, runtime, license_confirmed, release_state, exec_device)
      VALUES (?, ?, REPEAT(?, 64), REPEAT(?, 64), ?, TRUE, 'active', 'cpu')`, [id, label, w, c, runtime]);
  const want = { weights: 'a'.repeat(64), config: 'b'.repeat(64), runtime: 'torch-2.4.1-cpu' };
  it.each([
    ['해시', 'e', 'b', 'torch-2.4.1-cpu'],
    ['config', 'a', 'e', 'torch-2.4.1-cpu'],
    ['runtime', 'a', 'b', 'hand'],
  ])('실제로 켤 때 사람이 등록한 행의 %s만 달라도 이유를 찍고 멈추며 어떤 행도 바꾸지 않는다', async (_n, w, c, runtime) => {
    await conn.query('DELETE FROM model_version');
    await human(w, c, runtime);
    await expect(activateDevModels(conn, { M1: want })).rejects.toThrow(/M1: 사람이 등록한 활성 행 v1/);
    expect(await active()).toMatchObject([{ model_id: 'M1', runtime, weights_sha256: w.repeat(64) }]);
    expect(await active()).toHaveLength(1);
  });
  it('뒤 모델에서 멈추면 앞서 넣은 모델도 되돌린다', async () => {
    await conn.query('DELETE FROM model_version');
    await human('e', 'e', 'hand', 'M5');
    await expect(activateDevModels(conn, { M5: want })).rejects.toThrow(/M5: 사람이 등록한 활성 행 v1/);
    expect(await active()).toMatchObject([{ model_id: 'M5', runtime: 'hand' }]);
    expect(await active()).toHaveLength(1);
  });
  it('사람이 dev-로 시작하게 등록한 행도 사람 행으로 본다', async () => {
    await conn.query('DELETE FROM model_version');
    await human('e', 'e', 'hand', 'M1', 'dev-canary');
    await expect(activateDevModels(conn, { M1: want })).rejects.toThrow(/M1: 사람이 등록한 활성 행 dev-canary/);
    expect((await active()).find((v) => v.model_id === 'M1')).toMatchObject({ runtime: 'hand' });
  });
  it('실제로 켤 때 사람이 등록한 행이 같은 값이면 통과한다', async () => {
    await conn.query('DELETE FROM model_version');
    await human('a', 'b', 'torch-2.4.1-cpu');
    await activateDevModels(conn, { M1: want });
    expect((await active()).find((v) => v.model_id === 'M1')).toMatchObject({ runtime: 'torch-2.4.1-cpu', weights_sha256: 'a'.repeat(64) });
  });
  it('가짜로 켤 때는 사람이 등록한 행을 두고 경고만 찍는다', async () => {
    await conn.query('DELETE FROM model_version');
    await human('e', 'e', 'hand');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await activateDevModels(conn);
    expect((await active()).find((v) => v.model_id === 'M1')).toMatchObject({ runtime: 'hand' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('M1: 사람이 등록한 활성 행 v1'));
    warn.mockRestore();
  });

  it.each([
    ['없는 모델', 'models: {}\n', /M1: .*없음/],
    ['라이선스 미확인', `models:\n${ok('M1', 'a', 'r', 'license_confirmed: false')}`, /M1: 라이선스 미확인/],
    ['해시 없음', 'models:\n  M1: {runtime: r, license_confirmed: true}\n', /M1: .*해시/],
  ])('%s면 활성 행을 만들지 않고 이유와 함께 실패한다', (_n, body, why) => {
    expect(() => realVersions(['M1'], manifest(body))).toThrow(why);
  });

  it('기존 활성과 retired 버전을 보존하고 없는 모델만 채우며 반복해도 같다', async () => {
    await conn.query('DELETE FROM model_version');
    await conn.query(`INSERT INTO model_version
      (model_id, version_label, weights_sha256, config_hash, runtime, license_confirmed, release_state, exec_device)
      VALUES ('M2', 'existing', REPEAT('a', 64), REPEAT('b', 64), 'existing-runtime', TRUE, 'active', 'cpu'),
             ('M1', 'old', NULL, NULL, 'old-runtime', FALSE, 'retired', 'cpu')`);
    await activateDevModels(conn);
    await activateDevModels(conn);
    const [rows] = await conn.query(`SELECT model_id, version_label, runtime, release_state, weights_sha256, config_hash
      FROM model_version ORDER BY model_id, version_id`);
    const versions = rows as { model_id: string; version_label: string; runtime: string; release_state: string;
      weights_sha256: string | null; config_hash: string | null }[];
    expect(versions).toHaveLength(5);
    expect(versions.filter(v => v.release_state === 'active').map(v => v.model_id)).toEqual(['M1', 'M2', 'M3', 'M5']);
    expect(versions.find(v => v.model_id === 'M2')).toMatchObject({
      version_label: 'existing', runtime: 'existing-runtime', weights_sha256: 'a'.repeat(64), config_hash: 'b'.repeat(64),
    });
    expect(versions.find(v => v.version_label === 'old')).toMatchObject({ release_state: 'retired', runtime: 'old-runtime' });
    expect(versions.find(v => v.model_id === 'M1' && v.release_state === 'active')).toMatchObject({
      runtime: 'fake', weights_sha256: '0'.repeat(64), config_hash: '0'.repeat(64),
    });
  });
});
