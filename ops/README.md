# ops/ — 배포·운영 설정 (담당 B 이제민)

- `ecosystem.config.cjs`: pm2(app-api · model-api · worker-cpu · worker-gpu · sweeper, P0.5 llm-server). 모두 127.0.0.1 바인딩, Docker 없음.
- `nginx.conf`: HTTPS·라우팅(`/v1/models/*` → model-api, 나머지 `/v1/*` → app-api, `/internal/*`·런타임 포트 비노출).
- `DEPLOY.md`: 팀 서버 배포·확인·되돌리기 절차(T140).
- `team1_museum/`: **수업 점검 규격 모델 API 모음** — `app.py` · `bench.py` · `metrics.py`(공용, 수업본과 md5 같음) · `predict.py` · `schemas.py` · `settings.py` · `test_app.py` · `examples/` · `model/` · `requirements.txt` · 모듈카드. 해설 `docs/B/API_서비스_점검.pdf` 5쪽 여덟 파일 구조(SD_04 §3-4b). 실행: `cd ops/team1_museum && .venv/bin/python -m pytest -q test_app.py`
