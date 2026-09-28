// 앱 부트스트랩(T024): 라우터 마운트, /live, Problem Details 오류 처리(R-10), 허용 목록 로그(BR-PRV-01).
import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import type { Pool } from 'mysql2/promise';
import type { Config } from './config.js';
import { log } from './lib/logger.js';
import { Problem, parseSignal } from './lib/problem.js';
import type { StoragePort } from './storage/LocalFsDriver.js';
import { filesRouter } from './modules/files/routes.js';

export interface AppDeps { db: Pool; cfg: Config; storage: StoragePort; routers?: express.Router[] }

export function createApp({ db, cfg, storage, routers = [] }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    const t0 = Date.now();
    res.on('finish', () => log.info({ requestId: req.requestId, method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, durationMs: Date.now() - t0 }));
    next();
  });
  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));

  app.use(filesRouter(db, cfg, storage));
  for (const r of routers) app.use(r);

  app.use((_req, _res, next) => next(new Problem('not_found')));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let p: Problem;
    if (err instanceof Problem) p = err;
    else if ((err as { type?: string }).type === 'entity.parse.failed') p = new Problem('invalid_input', 'bad_json');
    else if ((err as { type?: string }).type === 'entity.too.large') p = new Problem('payload_too_large');
    else {
      const sig = parseSignal(err);
      p = sig ? new Problem(sig.gate === 'G11' ? 'validation_failed' : 'conflict', sig.reason, sig.gate) : new Problem('not_saved', 'internal');
      if (!sig) log.error({ requestId: req.requestId, code: 'internal', event: (err as { code?: string }).code ?? 'unknown' });
    }
    res.status(p.status).type('application/problem+json').json(p.body(req.requestId));
  });
  return app;
}
