# serving/ — 모델 서빙 (담당 A 최호준)

워커(`worker-cpu`·`worker-gpu`)·어댑터(M1~M7)·model-api 내부 경로·llm-server. 앱 API는 모델을 import하지 않는다(BR-MDL-02).

```bash
/opt/homebrew/bin/python3.11 -m venv .venv
.venv/bin/pip install --require-hashes -r requirements.lock      # 가짜 모델만: 이것으로 충분
.venv/bin/python -m pytest -q                                      # 임시 MariaDB를 스스로 띄운다
UAM_LIVE_OLLAMA=1 .venv/bin/python -m pytest -q -k live            # 공유 Ollama 실호출 1회
```

| 진입점 | 포트 |
|---|---|
| `python -m model_api.main` | 127.0.0.1:8100 — `/internal/ready`, `/internal/models`, `/internal/console` |
| `python -m workers.main --group cpu_vision\|gpu` | — |
| `python -m llm_server.main` (P0.5) | 127.0.0.1:8200 — `/v1/caption`, `/v1/ready`, `/v1/warmup` |
| `python -m ops.models …` | 모델 준비·적재 시간 측정·버전 등록 |

환경 변수: `DB_*`(또는 `DB_SOCKET`), `STORAGE_ROOT`, `MODEL_MANIFEST`, `UAM_RUN_DIR`, `UAM_FAKE_MODELS`, `UAM_FAKE_FAULTS`, `UAM_FAKE_LOAD_S`, `GPU_ENABLED`, `OLLAMA_URL`, `OLLAMA_CHAT_MODEL`, `LLM_SERVER_URL`, `LLM_WARM_ON_START`.
Ollama는 공유 서버다 — `docs/OLLAMA 설정 참조.md` §7·§8 규칙을 따른다(런타임에 pull·rm·stop 없음, keep_alive 5m, 동시 1).
