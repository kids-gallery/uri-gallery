// p1.sumzip.com 배포용 pm2 구성(ops/DEPLOY.md §7). 기본 구성 ops/ecosystem.config.cjs를 그대로 쓰고
// 저장소 루트 .env(git 제외)를 읽어 각 앱의 env로 넣는다 — 앱·서빙은 .env를 스스로 읽지 않는다(R-21).
// 더하는 것: 입구 nginx(9501, 평문 — TLS는 공유 nginx), Mailpit(127.0.0.1 1025/8025). TorchServe(M3)는 기본 구성에 있다(SD_04 §9-3 #4).
// 기동: pm2 start ops/p1/ecosystem.config.cjs && pm2 save
const fs = require('node:fs');
const path = require('node:path');
const base = require('../ecosystem.config.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const HOME = process.env.HOME;

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const ENV = readEnv(path.join(ROOT, '.env'));

const apps = base.apps.map((a) => ({ ...a, env: { ...(a.env || {}), ...ENV } }));

apps.push(
  {
    name: 'p1-nginx',
    script: '/opt/homebrew/bin/nginx',
    args: ['-p', path.join(ROOT, '.data', 'p1-nginx'), '-c', path.join(ROOT, 'ops', 'p1', 'nginx.conf'), '-g', 'daemon off;'],
    interpreter: 'none',
  },
  {
    name: 'mailpit',
    script: path.join(HOME, '.local', 'bin', 'mailpit'),
    args: ['--smtp', '127.0.0.1:1025', '--listen', '127.0.0.1:8025', '--database', path.join(ROOT, '.data', 'mailpit.db')],
    interpreter: 'none',
  },
);

module.exports = { apps };
