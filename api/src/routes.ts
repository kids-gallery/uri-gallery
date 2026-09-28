// 모듈 라우터 모음 — 스토리별로 여기에 붙인다.
import type { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import type { StoragePort } from './storage/LocalFsDriver.js';
import type { Mailer } from './modules/mail/mailer.js';
import { authRouter } from './modules/auth/routes.js';
import { childrenRouter } from './modules/children/routes.js';
import { artworksRouter } from './modules/artworks/routes.js';
import { galleryRouter } from './modules/gallery/routes.js';
import { deletionRouter } from './modules/deletion/routes.js';
import { familyRouter } from './modules/family/routes.js';
import { opsRouter } from './modules/ops/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { ModelApi } from './modules/ops/modelApi.js';
import { captionsRouter } from './modules/captions/routes.js';
import { LlmServer, type LlmPort } from './modules/captions/llmServer.js';

export interface Deps { db: Pool; cfg: Config; storage: StoragePort; mailer: Mailer; modelApi?: ModelApi; llm?: LlmPort; captionRetryDelaysMs?: number[] }

export function buildRouters(d: Deps): Router[] {
  const modelApi = d.modelApi ?? new ModelApi(d.cfg.modelApiUrl);
  return [opsRouter(d.db, d.cfg, modelApi), authRouter(d.db, d.cfg, d.mailer), childrenRouter(d.db), artworksRouter(d.db, d.cfg, d.storage, undefined, modelApi), galleryRouter(d.db, d.cfg), deletionRouter(d.db), familyRouter(d.db, d.cfg, d.mailer), adminRouter(d.db, d.cfg, d.storage, d.cfg.manifestPath),
    captionsRouter(d.db, d.cfg, d.llm ?? new LlmServer(d.cfg.llmServerUrl), d.captionRetryDelaysMs)];
}
