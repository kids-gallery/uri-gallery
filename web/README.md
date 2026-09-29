# web/ — 보호자 웹(/app) · 운영 웹(/ops) (담당 C 신지현 · /ops 화면 B 이제민)

Vue 3 · TypeScript · Vite 5 · Pinia · Vue Router 4. 화면 기준은 SD_02, 모양 기준은 `../design/style-guide/스타일가이드_우리아이미술관.html`(R-20). 계약: `../contracts/openapi.yaml`.

```bash
npm ci
npm run dev          # http://127.0.0.1:9501 — 로컬 PC에서만(팀 서버의 9501은 운영 nginx 몫, D19)
npm test             # Vitest + Vue Test Utils
npm run test:e2e     # Playwright 390px·1440px (빌드 후 preview로 띄움, WEB_PORT로 포트 변경)
npm run build        # web/dist → nginx가 /, /app/*, /ops/* 로 내보냄
```

경계: `src/app/`(보호자) · `src/ops/`(팀원) · `src/components/`(공통 C1~C10, /ops도 그대로 씀) · `src/styles/`(토큰) · `src/copy/`(문구) · `src/api/`(계약 타입·클라이언트). 개발 서버는 `/v1/models/*` → 9541, 그 밖의 `/v1/*` → 9521로 넘긴다.
