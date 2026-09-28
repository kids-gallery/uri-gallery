# ops/ — 배포·운영 설정 (담당 B 이제민)

- `ecosystem.config.cjs`: pm2(app-api · model-api · worker-cpu · worker-gpu · sweeper, P0.5 llm-server). 모두 127.0.0.1 바인딩, Docker 없음.
- `nginx.conf`: HTTPS·라우팅(`/v1/models/*` → model-api, 나머지 `/v1/*` → app-api, `/internal/*`·런타임 포트 비노출).
- `DEPLOY.md`: 팀 서버 배포·확인·되돌리기 절차(T140).
