<!-- SPECIFY:BEGIN managed -->
<!-- 이 블록은 update-agent-context.sh가 생성합니다. 직접 편집하지 마세요.
     블록 바깥의 내용은 보존됩니다. -->

## 활성 기능

**우리-아이-미술관**

- 명세: `.specify/features/우리-아이-미술관/spec.md`
- 계획: `.specify/features/우리-아이-미술관/plan.md`
- 데이터 모델: `.specify/features/우리-아이-미술관/data-model.md`
- API 계약: `.specify/features/우리-아이-미술관/contracts/openapi.yaml`
- LLM 호출 계약: `.specify/features/우리-아이-미술관/contracts/llm-contract.md`
- 시작 가이드: `.specify/features/우리-아이-미술관/quickstart.md`

## 기술 컨텍스트

| 항목 | 결정 | 근거 |
|------|------|------|
| 웹 프론트엔드 | Vue 3.4+ (Composition API) · TypeScript 5.x · Vite 5.x · Pinia 2.x · Vue Router 4 | Intent-Plan 웹스택, R-01 |
| 보호자 앱 API | Node.js 20 LTS · Express 4.x · TypeScript 5.x · mysql2 3.x (SQL 직접, ORM 없음) | Intent-Plan, U7 닫음(R-01) |
| 모델 기능 API | Python 3.11 venv · FastAPI · uvicorn (`model-api` :8100, 외부 `/v1/models/*`) · 모델마다 어댑터 | R3·BR-API-01, BR-MDL-02, R-01·R-10 |
| 서빙 3종 실체 | CPU 비전 = `worker-cpu`(큐 워커) · GPU = `worker-gpu`(큐 워커, 모델 상주) · LLM = `llm-server`(내부 동기 HTTP :8200, 큐 없음, P0.5) | BR-SRV-01, SD_01 P4 4.4, R-18 |
| 모델 | M1 BiRefNet `ZhengPeng7/BiRefNet` · M2 OpenCLIP `ViT-B-32`/`laion2b_s34b_b79k` · M3 Animated Drawings(`.mar` 2종, TorchServe 네이티브) · M4 기하 규칙 파일 · M5 `depth-anything/Depth-Anything-V2-Small-hf` · (P0.5) M6 **Qwen3-4B**(`Qwen/Qwen3-4B`, GGUF Q4_K_M, thinking 끔, 실행기 Ollama) · (P1) M7 `stabilityai/TripoSR` | REF §2, D16, R-22 |
| 저장소(DB) | 팀 MariaDB 12.0.2 `ABC10pioneer1` (utf8mb4). 스키마 정본 SD_03 `uri_gallery_ddl.sql`(D18·공동 보호자·구현 보완 S1~S9 포함, 테이블 35). 도메인 + 작업 큐(`FOR UPDATE SKIP LOCKED`) + 세션 | SD_03, data-model §6, R-04 |
| 저장소(파일) | `StoragePort` 인터페이스 + 로컬 파일시스템 드라이버(`family/`·`tmp/`·`ext/` 분리), 참조는 SD_03 `stored_object`. S3 호환 드라이버 교체 가능 | R-06 |
| 결과 파일 형식 | 움직임 MP4(H.264) · 2.5D 컷아웃 PNG + 깊이 PNG16(WebGL 시차) · 액자 = 원본 참조(새 파일 없음, `frame_compose` 작업) · P1 GLB | U9 닫음(R-07) |
| 보호자 인증·가족 | 이메일이 로그인 아이디(D18), argon2id, 가입 확인·재설정 메일 링크(1회용·해시 저장·UTC), 인증 경로 7개, 재설정 시 모든 세션 무효, 이메일·IP 요청 한도. 공동 보호자 초대·수락·해제·나가기 경로 7개, 해제·나가기 시 그 계정 세션 즉시 삭제, 가족 소속은 요청마다 DB 확인 | FR-9·31·32, 결정 ③④⑥, R-24·R-25 |
| 팀원·외부 인증 | 팀원 세션 쿠키 분리(`team_member` + 보완 S5 비밀번호) · 외부 `X-API-Key`(해시 저장, `team_internal`·`course_internal`·`external`·`test`) | U8 닫음(R-08) |
| 메일 발송 | nodemailer(SMTP) → P0 로컬 **Mailpit**(Homebrew, :1025/:8025). 실제 발송 제품은 U19 | 결정 ⑤, R-23 |
| API 형식 | REST JSON, 오류 RFC 9457 Problem Details + `code`, OpenAPI 3.1 | U8·U18 닫음(R-10) |
| 화면 갱신 | 폴링(3→6→10초, 전이 중 상태만, 숨김 탭 정지). 푸시 없음 | U8 닫음(R-12) |
| 배포 | Docker 없음 · pm2(app-api, model-api, worker-cpu, worker-gpu, sweeper, P0.5 llm-server) · Homebrew nginx(HTTPS·라우팅) · GitLab CI는 검사만 | Intent-Plan 첫 줄, R-02 |
| 시험 | Vitest·Supertest·Playwright(390/1440px) · pytest · 가짜 어댑터 장애 주입 · Redocly 계약 lint · Mailpit API로 메일 시험 | R-19 |
| 관측 | `/live`·`/ready`(모델별)·`/metrics`(prom-client, SD_03 `v_metrics_*` 뷰) · pino/structlog JSON 허용 목록 로그 | FR-12·13·26, BR-PRV-01, R-17 |
| 규모 가정 | P0 팀 내부 검증, 동시 사용자 10명 이하, 한 장 20MB 이하, 서버 1대 | spec Assumptions |
| 성능 목표(잠정) | 움직임 경로 확정→확인 대기 p95 3분 · 액자 경로 p95 30초 | spec SC(v1.0 잠정) |

<!-- SPECIFY:END managed -->
