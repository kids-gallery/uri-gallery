// 흐름 시험이 임시 스택의 app-api를 실제로 껐다 켠다(#37). global-setup이 남긴 설정과 프로세스 번호를 쓴다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_PORT } from './ports';

const API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../api');
const dir = () => { const d = process.env.E2E_DIR; if (!d) throw new Error('E2E_DIR 없음 — e2e/stack global-setup으로만 연다'); return d; };
const live = () => fetch(`http://127.0.0.1:${API_PORT}/live`).then((r) => r.ok, () => false);
async function until(want: boolean, what: string) {
  for (let i = 0; i < 120; i++) {
    if (await live() === want) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`E2E 스택: app-api ${what} 시간 초과`);
}

export async function stopApi() {
  process.kill(Number(fs.readFileSync(path.join(dir(), 'api.pid'), 'utf8')));
  await until(false, '종료');
}

export async function startApi() {
  const log = fs.openSync(path.join(dir(), 'api.log'), 'a');
  const env = JSON.parse(fs.readFileSync(path.join(dir(), 'api-env.json'), 'utf8')) as NodeJS.ProcessEnv;
  const p = spawn(path.join(API, 'node_modules/.bin/tsx'), ['src/server.ts'], { cwd: API, env, detached: true, stdio: ['ignore', log, log] });
  p.unref();
  fs.writeFileSync(path.join(dir(), 'api.pid'), String(p.pid));
  await until(true, '기동');
}
