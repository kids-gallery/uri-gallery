// #33: 개발용 최초 활성은 기존 버전을 보존하고 재실행해도 중복하지 않는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { activateDevModels } from '../scripts/migrate.js';
import { testPool } from './helpers/db.js';

describe('개발용 모델 최초 활성', () => {
  let db: Pool;
  let conn: PoolConnection;
  beforeAll(async () => {
    db = testPool();
    conn = await db.getConnection();
    await conn.query('DELETE FROM model_version');
  });
  afterAll(async () => {
    await conn.query('DELETE FROM model_version');
    conn.release();
    await db.end();
  });

  it('기존 활성과 retired 버전을 보존하고 없는 모델만 채우며 반복해도 같다', async () => {
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
