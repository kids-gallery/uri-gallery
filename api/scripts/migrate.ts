// 마이그레이션 실행기(T016, data-model §8): db/migrations/NNNN_*.sql을 순서대로, schema_migration(version, checksum)에 기록.
// DELIMITER 블록(트리거)을 지원한다. 같은 체크섬이면 건너뛰고, 기준 마이그레이션 0001은 멱등이라 다시 실행해도 안전하다.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import YAML from 'yaml';
import { loadConfig } from '../src/config.js';

// 빌드된 이미지에서는 파일 위치 계산이 어긋나므로 설정 값을 먼저 쓴다(마스터플랜 3-5 2번, api/Dockerfile).
export const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

/** 따옴표 밖의 줄 끝 `-- …` 주석을 떼어 낸다(`…;   -- 설명` 같은 줄의 문장 끝을 알아보기 위해). */
export function stripLineComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c;
    } else if (c === '-' && line[i + 1] === '-' && (i + 2 >= line.length || /\s/.test(line[i + 2]))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
}

/** DELIMITER를 해석해 문장 목록으로 나눈다. 주석은 버린다. */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let delim = ';';
  let buf = '';
  for (const raw of sql.split('\n')) {
    const line = stripLineComment(raw.replace(/\r$/, ''));
    const m = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
    if (m) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      delim = m[1];
      continue;
    }
    if (!line.trim()) { if (buf.trim()) buf += '\n'; continue; }
    buf += line + '\n';
    const trimmed = buf.trimEnd();
    if (trimmed.endsWith(delim)) {
      const stmt = trimmed.slice(0, -delim.length).trim();
      if (stmt) out.push(stmt);
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export async function migrate(conn: mysql.Connection, dir = MIGRATIONS_DIR): Promise<string[]> {
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migration (
    version VARCHAR(80) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()))`);
  const files = (await fs.readdir(dir)).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  const applied: string[] = [];
  for (const f of files) {
    const sql = await fs.readFile(path.join(dir, f), 'utf8');
    const sum = createHash('sha256').update(sql).digest('hex');
    const [rows] = await conn.query(`SELECT checksum FROM schema_migration WHERE version = ?`, [f]);
    const prev = (rows as { checksum: string }[])[0];
    if (prev?.checksum === sum) continue;
    for (const stmt of splitSql(sql)) await conn.query(stmt);
    await conn.query(
      `INSERT INTO schema_migration (version, checksum) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), applied_at = UTC_TIMESTAMP()`,
      [f, sum],
    );
    applied.push(f);
  }
  return applied;
}

type DevVersion = { weights: string; config: string; runtime: string };
const FAKE_VERSION: DevVersion = { weights: '0'.repeat(64), config: '0'.repeat(64), runtime: 'fake' };
const HEX64 = /^[0-9a-f]{64}$/;

/** 실제 어댑터로 돌릴 모델의 활성 행 값(마스터플랜 3-5 1번). 매니페스트로 설명할 수 없으면 이유를 찍고 멈춘다. */
export function realVersions(models: string[], manifestPath: string): Record<string, DevVersion> {
  const manifest = YAML.parse(readFileSync(manifestPath, 'utf8')) as { models?: Record<string, {
    weights_sha256?: string; config_hash?: string; runtime?: string; license_confirmed?: boolean }> };
  return Object.fromEntries(models.map((id) => {
    const m = manifest.models?.[id];
    if (!m) throw new Error(`${id}: ${manifestPath}에 없음`);
    if (m.license_confirmed !== true) throw new Error(`${id}: 라이선스 미확인이라 활성으로 만들 수 없음(${manifestPath})`);
    if (!HEX64.test(m.weights_sha256 ?? '') || !HEX64.test(m.config_hash ?? '') || !m.runtime) {
      throw new Error(`${id}: 매니페스트의 해시 또는 runtime이 없음(${manifestPath})`);
    }
    // 컨테이너에는 CPU 워커만 있다. 매니페스트의 -mps는 맥에서 잰 값이다
    return [id, { weights: m.weights_sha256!, config: m.config_hash!, runtime: m.runtime.replace(/-mps$/, '-cpu') }];
  }));
}

// 개발 전용: 사람이 등록한 활성 버전은 그대로 둔다. 개발용 행(dev-)은 지금 설정과 다르면 내리고 새로 넣는다. 0 해시는 실제 가중치의 검증값이 아니다.
export async function activateDevModels(conn: mysql.Connection, real: Record<string, DevVersion> = {}): Promise<void> {
  await conn.beginTransaction();
  try {
    for (const modelId of ['M1', 'M2', 'M3', 'M5']) {
      const want = real[modelId] ?? FAKE_VERSION;
      const [rows] = await conn.query(
        `SELECT version_id, version_label, weights_sha256, config_hash, runtime FROM model_version
          WHERE model_id = ? AND release_state = 'active' FOR UPDATE`, [modelId]);
      const active = (rows as { version_id: number; version_label: string; weights_sha256: string; config_hash: string; runtime: string }[])[0];
      if (active) {
        if (!active.version_label.startsWith('dev-')) continue;
        if (active.weights_sha256 === want.weights && active.config_hash === want.config && active.runtime === want.runtime) continue;
        await conn.query(`UPDATE model_version SET release_state = 'retired' WHERE version_id = ?`, [active.version_id]);
      }
      await conn.query(
        `INSERT INTO model_version
           (model_id, version_label, weights_sha256, config_hash, runtime, license_confirmed, release_state, exec_device)
         VALUES (?, CONCAT('dev-', REPLACE(UUID(), '-', '')), ?, ?, ?, TRUE, 'active', 'cpu')`,
        [modelId, want.weights, want.config, want.runtime],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const c = loadConfig().db;
  const conn = await mysql.createConnection({
    host: c.socketPath ? undefined : c.host, port: c.socketPath ? undefined : c.port, socketPath: c.socketPath,
    user: c.user, password: c.password, database: c.database, multipleStatements: false,
  });
  try {
    const done = await migrate(conn);
    console.log(done.length ? `applied: ${done.join(', ')}` : 'up to date');
    if (process.env.DEV_ACTIVATE_MODELS === '1') {
      const real = (process.env.DEV_REAL_MODELS ?? '').split(',').map((m) => m.trim()).filter(Boolean);
      await activateDevModels(conn, realVersions(real, loadConfig().manifestPath));
      console.log('development models initialized');
    }
  } finally {
    await conn.end();
  }
}
