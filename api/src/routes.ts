// 모듈 라우터 모음 — 스토리별로 여기에 붙인다.
import type { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import type { StoragePort } from './storage/LocalFsDriver.js';
import type { Mailer } from './modules/mail/mailer.js';
import { authRouter } from './modules/auth/routes.js';
import { childrenRouter } from './modules/children/routes.js';

export interface Deps { db: Pool; cfg: Config; storage: StoragePort; mailer: Mailer }

export function buildRouters(d: Deps): Router[] {
  return [authRouter(d.db, d.cfg, d.mailer), childrenRouter(d.db)];
}
