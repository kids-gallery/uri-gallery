import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createApp } from './app.js';
import { LocalFsDriver } from './storage/LocalFsDriver.js';
import { buildRouters } from './routes.js';
import { log } from './lib/logger.js';

const cfg = loadConfig();
if (!cfg.sessionSecret || !cfg.authHmacSecret) throw new Error('SESSION_SECRET·AUTH_HMAC_SECRET가 필요하다(.env)');
const db = createPool(cfg.db);
const storage = new LocalFsDriver(cfg.storageRoot);
const app = createApp({ db, cfg, storage, routers: buildRouters({ db, cfg, storage }) });
app.listen(cfg.port, '127.0.0.1', () => log.info({ event: 'listening', status: cfg.port }));
