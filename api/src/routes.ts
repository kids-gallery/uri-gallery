// 모듈 라우터 모음 — 스토리별로 여기에 붙인다.
import type { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import type { StoragePort } from './storage/LocalFsDriver.js';

export interface Deps { db: Pool; cfg: Config; storage: StoragePort }

export function buildRouters(_deps: Deps): Router[] {
  return [];
}
