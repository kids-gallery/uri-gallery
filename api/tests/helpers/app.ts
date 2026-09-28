import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { inject } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';
import { buildRouters } from '../../src/routes.js';
import { LocalFsDriver } from '../../src/storage/LocalFsDriver.js';
import { memoryMailer } from '../../src/modules/mail/mailer.js';
import { testPool } from './db.js';

export function testApp() {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'uams-'));
  const cfg = loadConfig({
    DB_SOCKET: inject('DB_SOCKET'), DB_USER: 'root', DB_NAME: 'uam_test', SESSION_SECRET: 'test-session-secret',
    AUTH_HMAC_SECRET: 'test-hmac', STORAGE_ROOT: store, SECURE_COOKIES: 'false', APP_BASE_URL: 'http://app.test',
  } as NodeJS.ProcessEnv);
  const db = testPool();
  const storage = new LocalFsDriver(store);
  const mailer = memoryMailer();
  const express = createApp({ db, cfg, storage, routers: buildRouters({ db, cfg, storage, mailer }) });
  // 시험 파일마다 서버 하나를 띄워 계속 쓴다(요청마다 임시 서버를 여닫으면 드물게 연결이 끊긴다)
  const app = express.listen(0, '127.0.0.1');
  const close = async () => { await new Promise((r) => app.close(r)); await db.end(); };
  return { app, db, cfg, storage, mailer, store, close };
}

export const tokenOf = (link?: string) => new URL(link!).searchParams.get('token')!;
