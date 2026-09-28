// pm2 구성(T008, research R-02) — Docker 없음. 모두 127.0.0.1에만 바인딩.
// 서빙 진입점은 A 구현(serving/, a/model-serving) 기준. 워커는 프로세스당 작업 1건 — 동시 처리는 instances로 맞춘다.
// worker-cpu는 팀 서버 RAM 확인(T068) 전까지 1개(M1 CPU 추론 RSS 8.5GB, A 실측).
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const PY = path.join(ROOT, 'serving', '.venv', 'bin', 'python');

module.exports = {
  apps: [
    { name: 'app-api', cwd: path.join(ROOT, 'api'), script: 'dist/src/server.js', interpreter: 'node', env: { NODE_ENV: 'production' } },
    { name: 'model-api', cwd: path.join(ROOT, 'serving'), script: PY, args: '-m model_api.main', interpreter: 'none' },
    { name: 'worker-cpu', cwd: path.join(ROOT, 'serving'), script: PY, args: '-m workers.main --group cpu_vision', interpreter: 'none', instances: 1, kill_timeout: 10000 },
    { name: 'worker-gpu', cwd: path.join(ROOT, 'serving'), script: PY, args: '-m workers.main --group gpu', interpreter: 'none', instances: 1, kill_timeout: 10000 },
    { name: 'sweeper', cwd: path.join(ROOT, 'api'), script: 'dist/src/sweeper/main.js', interpreter: 'node' }, // Node(T033·T099, c418639)
    // P0.5 — 큐 워커가 아닌 내부 동기 서버(research R-18). 공유 Ollama는 IPv4 127.0.0.1로만 부른다
    // { name: 'llm-server', cwd: path.join(ROOT, 'serving'), script: PY, args: '-m llm_server.main', interpreter: 'none',
    //   env: { OLLAMA_URL: 'http://127.0.0.1:11434', OLLAMA_CHAT_MODEL: 'qwen3:4b-instruct-2507-q4_K_M' } },
  ],
};
