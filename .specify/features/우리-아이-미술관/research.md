# Research: 우리 아이 미술관 — 기술 결정 (Phase 0)

**Created**: 2026-09-28
**Revised**: 2026-09-28 — SD_03(`15d63f8`)·D18(`e2091c0`, spec v2.2)·U1 확정(`ee62c57`)·공동 보호자(`c736817`) 반영, `llm-server`(R-18)·모델 구체 사양(R-22)·메일(R-23)·보호자 인증(R-24) 추가
**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) v2.2
**입력**: `Intent-Plan.md`(웹스택 Vue.js + Node.js, **Docker 컨테이너를 쓰지 않고 전개**), `design/REF_재작성공통기준_우리아이미술관.md`(§3 서빙 구조, §4 엔드포인트, §5 상태 모델, §8 BR, §11 D1~D17), `design/SD_01_프로세스설계서_우리아이미술관.md`(P0~P10, G0~G25, H1~H16), `design/SD_02_UIUX설계서_우리아이미술관.md`(S1~S12, C1~C10), `design/UC_ALL_우리아이미술관_통합명세.md`, **`design/SD_03_데이터베이스설계서_우리아이미술관.md`·`design/uri_gallery_ddl.sql`(스키마 정본)**, D18(UC13·UC14, G26·G27), `docs/역할분담.md`

> **표기**: 원천에 없고 이 계획에서 정한 값은 `[추론]`, 확정이 아닌 예시값은 `[예시값]`으로 표시한다. U 번호는 spec·REF §10의 공통 미해결 번호다. 이 문서의 각 항목은 **Decision / Rationale / Alternatives considered** 형식을 따른다.
> **실측 사실(2026-09-28, Studio-B에서 확인)**: 팀 DB는 MariaDB **12.0.2**, 문자셋 `utf8mb4`, 콜레이션 `utf8mb4_general_ci`, `lower_case_table_names=2`, 스키마 비어 있음. 개발 호스트는 Apple M1 Ultra(Metal, CUDA 없음) · Node v25.3.0(설치됨) · Python 3.11/3.14 · Homebrew `nginx 1.29.4`, `mariadb 12.0.2`, `openjdk 26`(링크 전) · `ollama` 설치됨 · `pm2` 사용 가능.

---

## R-01. 보호자 앱 스택 확정 (U7 닫음)

- **Decision**: Intent-Plan의 웹스택 **Vue.js + Node.js**로 확정한다.
  - 웹: Vue 3.4+ (Composition API, `<script setup>`), TypeScript 5.x, Vite 5.x, Pinia 2.x, Vue Router 4.
  - 앱 API: Node.js **20 LTS**, Express 4.x, TypeScript 5.x, mysql2 3.x(Promise API).
  - DB: 팀 MariaDB(`ABC10pioneer1`, 12.0.2). SQL 쿼리 기반 데이터 조작(ORM 없음).
  - **모델 서빙 계층은 Python으로 분리**한다(R3, BR-API-01): Python 3.11 가상환경 + FastAPI + uvicorn. 앱 API는 모델을 import하지 않는다(BR-MDL-02).
- **Rationale**: Intent-Plan이 스택을 이 조합으로 지정했다. REF §3의 `[추론]`(모델 서빙은 Python 고정, 보호자 앱 스택만 plan에서 정함)과도 맞는다. 두 계층의 경계는 DB 작업 테이블(`stage_job`)과 내부 HTTP(준비·취소)뿐이라 언어가 달라도 계약 하나로 묶인다(FR-25 "작업 계약 하나").
- **Node 버전**: 개발 호스트에는 v25가 깔려 있지만 Intent-Plan이 **v20 LTS**를 지정하므로 `.nvmrc`=`20`과 `package.json` `engines.node: ">=20 <21"`로 고정한다. v25에서만 되는 API(예: 내장 `node:sqlite`)는 쓰지 않는다.
- **Alternatives considered**: React+FastAPI+PostgreSQL(팀 DB가 MariaDB라 탈락), Django(웹·API 일체형이라 R3 모델 계층 분리가 흐려짐), Next.js(SSR 이점이 가족 전시 규모에서 작음). 앱 API까지 Python으로 통일하는 안은 Intent-Plan 지정과 어긋나 제외.

## R-02. Docker 없이 전개 — 프로세스·배포 방식

- **Decision**: 모든 구성요소를 호스트 네이티브 프로세스로 띄운다.
  - 프로세스 관리: **pm2** `ecosystem.config.cjs` 하나로 `app-api`(Node), `model-api`(uvicorn), `worker-cpu`, `worker-gpu`, `sweeper`(이어받기·임시 파일·삭제 재시도), (P0.5) `llm-server`(R-18, 큐 워커가 아닌 내부 동기 서버)를 관리한다. 부팅 자동 시작은 `pm2 startup`(macOS launchd).
  - 리버스 프록시·HTTPS: Homebrew **nginx** 네이티브. 정적 웹(`web/dist`) 서빙 + `/v1/models/*` → model-api, 그 밖의 `/v1/*`·`/live`·`/ready`·`/metrics`·`/openapi.json` → app-api.
  - 모델 런타임: TorchServe(M3)·Ollama(M6)는 네이티브 설치, **127.0.0.1에만 바인딩**(BR-SRV-04).
  - CI: GitLab CI는 lint·타입 검사·단위 시험만 돌린다. 배포는 `ssh` + `git pull` + `npm ci && npm run build` + `pm2 reload`(컨테이너 빌드 없음).
- **Rationale**: Intent-Plan 첫 줄 "docker 컨테이너를 사용하지않고 전개한다"가 본문 "개발환경/배포: Docker"보다 구체적이고 나중에 적힌 지시다. 본문의 Docker 항목은 이 결정으로 대체한다(plan.md Complexity Tracking에 기록).
- **Alternatives considered**: launchd plist 직접 작성(프로세스 6개 관리가 번거로움), systemd(팀 서버 OS 미확인, U14와 함께 확인), supervisord(Python 쪽만 편함). pm2는 Node·Python 프로세스를 같은 방식으로 다룬다(`interpreter` 지정).

## R-03. M3 Animated Drawings·TorchServe의 Docker 없는 실행 (BR-MDL-06 대체 방식)

- **Decision**: 원천의 "내부 TorchServe, Docker 고정 이미지"를 **고정 가상환경 + 잠금 파일 + 체크섬 + 루프백 바인딩**으로 대체한다.
  - M3 전용 가상환경 `serving/.venv-m3`(Animated Drawings 요구 Python 버전으로 따로 둠), `requirements-m3.lock`(해시 고정 `pip install --require-hashes`).
  - TorchServe는 `torchserve --start --ncs --ts-config serving/runtime/torchserve.properties`로 네이티브 실행. `inference_address=http://127.0.0.1:8080`, `management_address=http://127.0.0.1:8081`, `metrics_address=http://127.0.0.1:8082`, `enable_token_auth`(가능 버전이면 켬). Java 17 런타임 필요(Homebrew `openjdk@17` 권장, 현재 openjdk 26만 있음 → 호환 확인 필요).
  - `.mar` 파일 2개(검출·자세)의 SHA-256을 매니페스트에 기록한다.
  - 매니페스트의 `image_digest` 필드는 컨테이너 이미지 대신 **실행 환경 다이제스트**(`requirements-*.lock` + 런타임 설정 파일 + `.mar` 해시를 이은 SHA-256)를 담는다. 필드 이름은 BR-MDL-01·SD_03과 맞추려고 유지한다.
- **Rationale**: 격리의 목적(외부 접근 차단, 고정 버전, 변조 탐지)은 루프백 바인딩·해시 잠금·체크섬으로 같은 수준을 지킨다. 관리 포트(8081)는 외부로 열지 않고 방화벽으로도 막는다.
- **확인 필요(위험)**: Animated Drawings의 렌더는 OpenGL을 쓴다. 개인 PC 실측(53~62초)은 Docker 기반이었으므로 **네이티브 macOS/Linux 헤드리스 렌더 재현을 1~2일차에 먼저 확인**한다(A 담당, `docs/A_모델재현기록.md`). 실패하면 예비안(그림 전용 YOLOv8 자세 모델 ONNX, AGPL → U4 결정 전 비활성)으로 가지 않고, M3를 `model_not_ready`로 두어 움직임 경로만 인프라 재시도 규칙을 따르게 한다(FR-12). 이때도 2.5D·액자 경로는 동작한다.
- **Alternatives considered**: Docker 예외 허용(Intent-Plan 위반), TorchServe 없이 Animated Drawings 파이썬 API 직접 호출(검출·자세 모델이 TorchServe `.mar` 전제로 배포되어 재포장 비용이 큼).

## R-04. 작업 DB·큐 — 단계 작업 점유와 이어받기

- **Decision**: 별도 메시지 브로커 없이 **MariaDB 작업 테이블 + 전용 워커**(REF §3 "DB 작업 테이블 + 전용 워커")로 큐를 만든다.
  - 테이블은 SD_03 `stage_job`(점유 컬럼 `claimed_by`·`claim_expires_at`)에 보완 S1·S2(`available_at`, `priority`, 인덱스 `ix_sj_claim`)를 더해 쓴다(data-model §6).
  - 점유: `SELECT … FROM stage_job WHERE serving_group=? AND status IN ('queued','retry_wait') AND available_at<=UTC_TIMESTAMP() ORDER BY priority, queued_at LIMIT 1 FOR UPDATE SKIP LOCKED` → 같은 트랜잭션에서 `status='running', claimed_by, claim_expires_at=+60s, attempt_count=attempt_count+1`. MariaDB 10.6+의 `SKIP LOCKED`를 쓴다(팀 DB 12.0.2 확인).
  - 점유 갱신(heartbeat): 워커가 `claim_expires_at`을 주기적으로 늘린다. 기본 점유 **60초, 20초마다 갱신** `[추론]`.
  - 이어받기(BR-PRC-05): `claim_expires_at < UTC_TIMESTAMP()`인 `running` 작업은 sweeper가 `retry_wait`로 되돌린다. 이어받기도 시도 횟수에 들어간다(spec Edge Cases). `삭제 중` 작품의 작업은 되돌리지 않고 `cancelled`로 닫는다(D4).
  - 재시도 간격(BR-PRC-03 "간격을 늘려"): 첫 실패 뒤 **10초**, 두 번째 뒤 **60초** `[추론]`. 시도는 첫 시도 포함 최대 3회(D1).
  - 우선순위: 보호자 단계 작업 `priority=10`, 평가 작업 `priority=50`, 외부 호출은 별도 테이블 SD_03 `external_job`(보완 S4로 점유 컬럼 추가)에 두어 보호자 작업 뒤에 점유한다(D17 "낮은 우선순위의 별도 대기열"). 외부 작업은 서빙군별 외부 동시 처리 1건 `[예시값 U12]`으로 제한한다.
  - 동시 처리 상한(BR-PRC-07): 워커 프로세스별 `max_concurrency`를 모델별 설정 `serving/config/limits.yaml`로 둔다. 상한에 닿으면 가져오지 않고(거절하지 않음) 대기열에 남긴다.
- **Rationale**: P0 동시 사용자 10명 이하(spec Assumptions) 규모에서 DB 큐로 충분하고, 내구 접수(BR-INT-02)와 같은 트랜잭션에서 작업을 등록할 수 있다. Redis 등 별도 서버를 늘리지 않는다(Docker 없음 조건에서 운영 부담 축소).
- **Alternatives considered**: Redis + BullMQ(Node 전용이라 Python 워커와 계약이 둘로 갈림), Celery + RabbitMQ(브로커 추가, 내구 접수와 원자성 분리), PostgreSQL LISTEN/NOTIFY(팀 DB가 MariaDB).

## R-05. 단계 작업 계약과 응답 분류 (BR-API-02, U18 일부)

- **Decision**: 어댑터·워커의 응답 분류를 아래 8개로 고정하고, SD_03 `stage_job`의 `status`·`error_class`·`downgrade_cause` 조합과 1:1로 맞춘다(`ok`→`done`, `quality_below`→`done_downgraded`+`downgrade_cause`, 인프라 5종→`retry_wait`/`failed`+`error_class`, `cancelled`→`cancelled`). 상세는 `contracts/stage-job.md` §4, data-model §2.2.
  - `ok` · `quality_below`(모델 낮춤 트리거, 재시도 안 함) · `engine_down` · `timeout` · `storage` · `db` · `model_not_ready`(이 다섯이 인프라 오류 분류, 재시도 대상) · `cancelled`(삭제로 취소, 지표에서 뺌)
  - 역할분담 문서의 초안(`ok / quality_below / engine_down / timeout / storage / model_not_ready / cancelled`)에 **`db`를 더했다**. spec FR-5·Glossary의 오류 분류 5종(엔진 다운·시간 초과·저장소·DB·모델 미준비)에 DB가 있기 때문이다.
  - 낮춤 원인(`downgrade_cause`)과 오류 분류(`error_class`)는 **배타 컬럼**이며 SD_03 `chk_sj_cause_exclusive`가 동시 기입을 막는다(SD_01 H5, BR-FBK-04). 결과 원인 5분류는 SD_03 결정대로 `artwork_outcome.result_cause` 한 곳에 기록한다.
- **Rationale**: 원인 5분류를 섞지 않는다는 요구(FR-5, SC "원인 분리 정확도")를 DB 제약으로 강제한다.

## R-06. 원본·결과 저장소 (Docker 없는 S3 호환 요구)

- **Decision**: 저장소를 `StoragePort` 인터페이스(put/get/delete/exists/list-by-prefix)로 감싸고 P0 구현은 **로컬 파일시스템 드라이버**로 한다. S3 호환 드라이버(MinIO 네이티브 바이너리 또는 외부 S3)는 같은 인터페이스로 바꿔 끼울 수 있게 둔다.
  - 루트 `STORAGE_ROOT`(예: `/srv/uam/store`), 영역 분리: `family/`(원본·마스크·깊이·결과·GLB), `tmp/`(단계 작업 임시), `ext/`(외부 호출 임시, D8 — 가족 영역과 경로 분리).
  - 객체 키는 **불투명 UUID**(`family/{artwork_uuid}/{kind}/{uuid}.{ext}`), 별칭·제목을 경로에 넣지 않는다.
  - 원본 쓰기: `tmp`에 쓰고 `fsync` → `rename`으로 확정, 파일 권한 `0440`, 덮어쓰기 금지(`O_EXCL`) — BR-INT-04 원본 불변.
  - 파일은 가족 인증을 거친 앱 API의 `GET /v1/files/{token}`으로만 내려준다(nginx `internal` 위치 + `X-Accel-Redirect`). 정적 공개 경로는 없다(BR-ACC-01).
- **Rationale**: 단일 팀 서버에서 API·워커가 같은 파일시스템을 본다. Docker 없이 MinIO를 추가하는 부담을 P0에서 피하되 spec의 "S3 호환" 의도는 인터페이스로 보존한다.
- **Alternatives considered**: MinIO 네이티브(가능, 운영 프로세스 하나 추가 — 다중 서버로 나눌 때 채택), DB BLOB(20MB 원본에 부적합).
- **확인 필요**: 워커가 다른 서버(GPU 서버)에 있게 되면(U2) S3 드라이버로 바꾼다.

## R-07. 결과 파일 형식 (U9 닫음)

- **Decision**:
  - **움직임(animated)**: **MP4(H.264, 무음, 24fps `[추론]`)** 한 파일(`stored_object.object_kind='result_animated'`). 포스터는 별도 파일 없이 `<video preload="metadata">` 첫 프레임을 쓴다(SD_03 객체 종류에 포스터가 없음). `<video>`는 `autoplay` 없이, 누를 때만 재생·정지, `loop`은 보호자가 켠 동안만(BR-EXH-03). Animated Drawings 출력(GIF)을 워커에서 ffmpeg로 MP4로 바꾼다.
  - **2.5D 부조(relief)**: **컷아웃 PNG(RGBA, M1 결과 `judgment.cutout_object_id` 재사용) + 깊이맵 PNG(16bit 그레이스케일, `result_relief`)** 두 파일. 화면에서 WebGL 셰이더(작은 자체 컴포넌트, 라이브러리 없이 또는 `three` 최소 사용)로 시차 효과를 준다. 효과는 누를 때만, `prefers-reduced-motion`이면 정지 화면 우선. 정지 대체 이미지로 컷아웃 PNG를 쓴다.
  - **원본 액자(frame)**: **새 파일을 만들지 않는다.** SD_03의 `frame_compose` 단계 작업(모델 없음)이 `result(frame, object_id=NULL)`만 기록하고, 화면은 원본(`artwork_original`)을 CSS 액자로 그린다. 원본 불변·모델 없음(BR-PRC-01)을 가장 단순하게 지킨다.
  - **3D 조각(sculpture, P1)**: GLB. `<model-viewer>`(Google, npm)로 회전은 누를 때만.
- **Rationale**: MP4는 GIF보다 용량이 작고 재생 제어가 된다. 깊이맵+셰이더는 원본의 선과 색을 픽셀 단위로 보존하면서 시차만 더한다(FR-22 "선과 색을 바꾸지 않는다"). 액자는 합성 이미지를 만들지 않으므로 "원본 변형 0건" 검증이 쉬워진다.
- **Alternatives considered**: GIF(용량·색 제한), 부조를 미리 렌더한 MP4(시차 상호작용 불가, 파일 증가), 액자 합성 PNG(원본과 다른 파일이 생겨 원본 불변 검증이 복잡).

## R-08. 인증·세션·역할 (U1 잠정, U8 인증 방식 닫음)

- **Decision**:
  - **보호자**: D18 — **이메일이 로그인 아이디**, 비밀번호는 argon2id 해시(`guardian_account.password_hash`). 가입·확인·찾기·재설정은 R-24. 세션은 `express-session` + MariaDB 저장소(보완 S6 `app_session`), 쿠키 `HttpOnly; Secure; SameSite=Lax`, 유휴 만료 30분 `[추론]`. 가족 ID는 **세션에서만** 정한다(SD_01 1.1 G0). 요청마다 세션 생성 시각이 `password_changed_at`보다 이르면 무효(결정 ⑥).
  - **U1 확정(`ee62c57`)**: 가입이 가족 공간을 함께 만들고(FR-31) 그 계정이 만든 보호자(`role='owner'`)가 된다. 공동 보호자 초대·같은 권한은 R-25.
  - **팀원**: SD_03 `team_member` + `team_member_role`(`operator` / `evaluator` / `integrator`, 한 사람이 여러 역할 가능, BR-ACC-05). SD_03에 비밀번호 컬럼이 없어 보완 S5(`password_hash`)를 더한다. 운영 로그인 경로 `/ops/login`. 보호자 세션과 쿠키 이름을 나눈다(`uam_sid`, `uam_ops_sid`). 팀원 계정은 가족 테이블에 대한 조회 권한 자체가 없는 API 라우터만 쓴다(BR-ACC-03).
  - **외부 클라이언트**: `X-API-Key` 헤더. 키 원문은 발급 시 한 번만 보이고 DB에는 SHA-256 해시만 저장(`api_key.key_hash`). 키 종류는 SD_03 `key_kind` — `team_internal`·`course_internal`·`external`·`test`. `pose`는 `team_internal`·`test`만(트리거 `trg_external_job_bi`, D17). U12 확정 전에는 `external` 키를 발급하지 않는다.
  - 다른 가족 자원 접근은 **404**로 존재를 숨긴다(SD_02 S8 "찾을 수 없어요", SD_01 1.4).
- **Rationale**: 소수 사용자·단일 도메인 웹에서 세션 쿠키가 JWT보다 폐기·만료가 단순하다. 외부 API는 서버 간 호출이라 키 방식.
- **Alternatives considered**: JWT(폐기 어려움), OAuth(외부 IdP 연동은 P0 범위 밖).

## R-09. 요청 한도·크기 제한 (U12 예시값 적용)

- **Decision**: 키당 분당 30건 · 하루 1,000건 · 동시 진행 작업 2건 · 요청 1건에 이미지 1장 · 20MB · 외부 결과 보관 1시간 · 서빙군별 외부 동시 처리 1건 — 모두 `[예시값 U12]`이며 설정 파일(`serving/config/ext-limits.yaml`)로 둔다. 별도 카운터 테이블 없이 SD_03 `external_call_log`(모든 호출·거절 기록, `ix_ecl_key_time`)를 최근 1분·1일 창으로 세고, 동시 진행은 `external_job`의 `queued`·`running` 수로 판정한다. 초과 시 429 + `Retry-After`.
- **발급 주체**: 서비스 운영자가 발급·폐기한다 `[예시값 U12]`. SD_02는 키 발급 화면을 "만들지 않는 화면"으로 두었으므로 P0에서는 **운영 CLI**(`npm run ops:key -- issue --kind team_internal`)로 발급한다. 화면화는 U12 확정 뒤.
- **Rationale**: 수치는 확정이 아니므로 코드가 아니라 설정으로 두어 U12 확정 시 설정만 바꾼다.

## R-10. 외부 모델 기능 엔드포인트의 위치와 오류 분류 (U8·U18 닫음)

- **Decision**:
  - `/v1/models/*`는 **Python model-api(uvicorn)** 가 직접 제공한다(R3: "모델 기능은 Python 가상환경 + uvicorn으로 띄운 API로 제공"). nginx가 이 경로만 model-api로 보낸다. model-api도 모델을 직접 부르지 않고 `external_job`을 등록해 워커가 어댑터로 처리한다(보호자 흐름과 같은 어댑터·활성 버전, FR-28).
  - 경로: `POST /v1/models/{segment|classify|pose|relief}` → **202** `{job_id, status:"queued", model:{id,version}}`, `GET /v1/models/jobs/{job_id}` → `queued|running|done|failed`, `GET /v1/models/jobs/{job_id}/result` → 결과 1회 제공 후 즉시 삭제, 재조회 404(SD_01 10.7). `caption`(P0.5)은 동기 200, P0에서는 404. `sculpture`/3D는 항상 404(D9).
  - 응답 형식: 성공은 JSON, 오류는 **RFC 9457 Problem Details**(`application/problem+json`) + 필드 `code`.
  - **연동 오류 분류(U18)**: `unauthorized`(401, 키 없음·무효·폐기) · `forbidden_scope`(403, 외부 키로 `pose`, 기능 권한 없음) · `rate_limited`(429 + `Retry-After`) · `payload_too_large`(413) · `invalid_input`(422, 형식·판독 불가·필수 필드 누락·`caption`에 이미지·이름 필드 포함) · `not_found`(404, 없는 기능·P0의 caption·3D·이미 받아 간/만료 결과) · `model_not_ready`(503, 활성 버전 없음·라이선스 미확인 `classify`·서빙군 미준비 — 작업을 만들지 않음) · `timeout`(504, P0.5 `caption` 동기 시간 초과) · `conflict`(409, 상태 충돌). 인증 실패는 한도를 차감하지 않는다(UC12 `[추론]`). 처리 결과의 `outcome`은 R-05 분류를 그대로 쓴다(`ok`/`quality_below`/인프라 5종).
  - **코드 통일**: UC12 시퀀스의 503 코드 `model_unavailable`과 UC3 대응표의 `model_not_ready`를 **`model_not_ready` 하나로 통일**한다(요청 거절 코드와 처리 결과 분류가 같은 사실을 가리키므로).
  - 앱 API의 오류도 같은 Problem Details 형식과 `code` 목록을 쓴다: `unauthorized`(401) · `forbidden_role`(403, 팀원 역할 없음) · `not_found`(404, 다른 가족 자원 포함) · `conflict`(409, 상태 전이 불가·승인된 설명 재생성·`삭제 중`) · `invalid_input`(400, 형식·판독 불가 — UC_ALL §7.11 1.2 배정 `400`을 따름) · `payload_too_large`(413) · `validation_failed`(422, 빈 별칭·미래 제작일·연령 범위·비밀번호 확인 불일치 등 필드 검증. 별칭 중복은 D18로 오류가 아님) · `token_invalid`(400, 메일 링크) · `email_unverified`(403, 로그인) · `rate_limited`(429) · `not_saved`(503, 저장 실패 — "접수되지 않았어요"/"저장되지 않았어요").
- **Rationale**: 인프라 오류 5종은 **처리 결과 분류**이고 `invalid_input` 등은 **요청 거절 분류**라 층위가 다르다. 둘을 다른 필드(`code` vs `outcome`)로 나눠 U18의 "Intent 5종에 없음" 문제를 해결한다.

## R-11. 'API활용' 메뉴 위치와 조회 범위 (U17 닫음)

- **Decision**: 같은 Vue 앱의 **운영 영역 `/ops/api-guide`**(S12)에 둔다. 보호자 라우트(`/app/*`)와 링크로 이어지지 않으며(UX8), 라우터 가드와 API 양쪽에서 역할을 확인한다.
  - 엔드포인트 탭: app-api `/openapi.json`(보호자 앱·운영·관리 묶음)과 model-api `/v1/models/openapi.json`(모델 기능 묶음)을 합쳐 4묶음으로 생성(SD_01 9.2). 활성 모델 버전은 `/ready`와 대조해 표시(BR-API-08).
  - 조회 범위: `integrator`와 `operator`는 4묶음 **명세 전부를 읽을 수 있다**(관리 엔드포인트 포함, 읽기 전용). 관리 엔드포인트 **호출**은 `evaluator`만(BR-ACC-05). 시험 호출은 `integrator`·`operator`가 평가 묶음 작품만으로 한다(BR-API-09, G23).
- **Rationale**: 명세는 비밀이 아니고 연동 준비에 필요하다. 권한은 호출에서 막는다.

## R-12. 화면 갱신 방식 (U8 폴링/푸시 닫음)

- **Decision**: **폴링**. 전이 중 상태(`판정 중`·`처리 중`·`삭제 중`)인 작품을 보는 화면(S3·S4 상세·S9)만 `GET /v1/artworks/{id}`를 **3초 → 6초 → 10초**로 늘려 가며 부르고, 탭이 숨겨지면 멈춘다(`document.visibilitychange`). 목록(S4)은 열 때·새로고침 때 갱신(SD_02 §17). S12 외부 작업 상태도 같은 방식. 서버 푸시(SSE·WebSocket)는 쓰지 않는다.
- **Rationale**: SD_02가 "토스트·푸시 금지", "열 때와 새로고침 때 갱신"을 정했다. 폴링 대상이 소수라 부하가 작다.

## R-13. HEIC 판독과 이미지 검사 (BR-INT-01)

- **Decision**: 앱 API는 `sharp`로 JPEG·PNG 헤더·디코드 가능 여부를, HEIC는 `heic-decode`(libheif wasm)로 판독만 검사한다. 원본은 **변환 없이** 그대로 저장한다. 워커(Python)는 `pillow-heif`로 읽는다. 매직 바이트로 형식을 먼저 가리고, 확장자·`Content-Type`은 믿지 않는다. 용량 상한 20MB는 nginx `client_max_body_size 21m`과 multer `limits.fileSize`에서 이중으로 건다.
- **Rationale**: prebuilt `sharp`는 HEVC 특허 문제로 HEIC 디코드를 빼고 배포된다. 판독 검사는 앱 API의 일(접수)이지 모델이 아니므로 BR-MDL-02에 걸리지 않는다.

## R-14. 내구 접수의 원자성 (BR-INT-02, G6)

- **Decision**: 순서 = ① 검사(G5) → ② 원본을 `tmp/`에 쓰고 fsync → ③ DB 트랜잭션(`artwork` + `stored_object(original)` + `artwork_original` + `stage_job(split)` + `stage_job(judge)` INSERT) → ④ 커밋 뒤 원본을 `family/`로 rename → ⑤ **202**. ③ 실패 시 tmp 원본 삭제, ④ 실패 시 행을 지우는 보상 트랜잭션 후 "접수되지 않았어요". 커밋됐지만 rename 전 서버가 죽은 경우를 위해 워커는 원본이 `tmp`에 있으면 sweeper가 옮기기를 마칠 때까지 `storage`로 재시도한다. sweeper는 DB 행이 없는 tmp 원본을 10분 뒤 지운다.
- **멱등성(BR-INT-03)**: 클라이언트가 만든 UUID를 `Idempotency-Key` 헤더로 보내고 SD_03 `artwork.request_no`에 저장(`uq_artwork_request(family_id, request_no)`). 중복이면 기존 작품을 **202**로 그대로 돌려준다(SD_01 2.3).

## R-15. 삭제·취소 (BR-DEL-01~05, G18·G19)

- **Decision**: `DELETE` → 트랜잭션에서 `artwork.status='deleting'`·`deleting_since`, 해당 `stage_job` 전부에 `cancel_requested_at`, SD_03 `deletion_request`(`accepted`→`waiting_stop`) → **202**. 워커는 heartbeat마다와 **결과를 쓰기 직전**에 취소 플래그를 확인해 멈추고 `outcome='cancelled'`로 닫는다(SD_01 0.11). 실행 중 외부 프로세스(TorchServe 요청, 렌더 하위 프로세스, Ollama 요청)는 끊는다. sweeper가 SD_03 `v_deletion_hold`로 멈춤을 확인한 뒤(G19, 또는 점유 만료 + 유예 30초 `[추론]`) `deleting_files`로 넘겨 파일과 `stored_object`를 지우고 `artwork`를 지운다. 집계는 SD_03 `artwork_outcome`(작품 연결 SET NULL)과 `stage_job`(SET NULL)에 남는다(BR-DEL-02, H13). 끝나면 `deletion_request`의 연결을 NULL로 두고 `completed`(트리거 `trg_deletion_bu`). 파일 삭제 실패는 1분·5분·30분 `[추론]` 간격으로 3회 재시도(`file_retry_count`), 이후 `incomplete`(삭제 미완료 수).
- **미해결 유지**: 삭제 미완료 건을 끝내는 주체(SD_01 §17 #1)는 이 계획에서 **운영자 CLI `npm run ops:purge-retry`** 로 둔다 `[추론]`. 화면은 만들지 않는다(SD_02 §18).

## R-16. 모델 매니페스트·승격·롤백 저장 방식 (FR-24)

- **Decision**: 원천은 파일 `models/manifest.yaml`(A 소유)이고, DB `model_version` 테이블이 **실행 시 기준**이다. 등록 명령(`npm run ops:manifest-sync` 또는 평가 화면의 "후보 등록")이 YAML을 읽어 DB에 후보로 넣는다. 활성·롤백 후보 전환은 DB에서만 한다 — SD_03 `model_version.release_state`(`candidate`·`active`·`rollback_candidate`·`retired`)와 `uq_mv_one_active`(모델당 활성 1건), 이력은 `release_event`(승격은 `v_promotion_eligibility`가 판정, 트리거 `trg_release_event_bi`). 워커는 작업 **시작 시점**의 활성 버전을 `stage_job.model_version_id`에 적고 그 버전으로 끝낸다(SD_01).
- `license_confirmed=FALSE`인 버전은 활성화할 수 없다(SD_03 `chk_mv_license_active`, BR-MDL-07, `classify`는 A2 기록 전 비활성).
- 롤백 후보가 없을 때 모델을 비활성하는 방법(SD_01 §17 #2): 평가 담당이 `POST /v1/admin/models/{mid}/deactivate`로 활성 버전을 `retired`로 내린다(clarify `ee62c57`로 주체 확정, `release_event.kind`에 `deactivate` 추가는 SD_03 개정 대상, data-model S9). 비활성은 "미준비"와 구분되는 운영 상태(`/ready` 칩 `inactive_deactivated` `[추론]`)이며, 그 모델이 필요한 확정 선택지는 이유와 함께 막아 새 작업을 만들지 않는다. 이미 대기 중인 작업은 `model_not_ready` 규칙을 따르고 낮춤 체인으로 우회하지 않는다.

## R-17. 지표와 로그 (FR-13, FR-26, BR-PRV-01)

- **Decision**:
  - `/metrics`: app-api가 `prom-client`로 노출. 지표 값은 SD_03 뷰(`v_metrics_service`, `v_metrics_model`, `v_cause_breakdown`, `v_not_delivered_trace`, `v_external_usage`)에서 읽고, p95만 `stage_job`의 `started_at`·`finished_at`으로 앱에서 계산한다(SD_03 주석: "p95는 애플리케이션에서만"). 라벨은 `model_id`, `model_version`, `serving_group`, `cause`, `error_class`만(BR-OPS-04). 워커 프로세스 지표(큐 대기)는 DB에서 계산하므로 워커는 따로 노출하지 않는다.
  - 운영 화면(S10)은 `GET /v1/admin/metrics?from&to`(JSON)를 쓴다. Prometheus 서버 설치는 P0 필수가 아니다(수집 가능한 엔드포인트만 보장, FR-26).
  - 로그: Node `pino`, Python `structlog` JSON. **허용 목록 방식**으로 필드를 고른다(`request_id`, `route`, `status`, `code`, `stage`, `model_id`, `model_version`, `outcome`, `duration_ms`). 이미지·객체 키·자유 입력·예외 원문은 넣지 않는다. 예외는 `error_class` 코드로만 남긴다.

## R-18. LLM 서버(`llm-server`) — 설명 생성 M6의 서빙 (P0.5, U3·U11)

**정의**: `llm-server`는 서빙 3종 중 **"LLM 서버"(REF §3, BR-SRV-01)를 실행하는 프로세스 하나**다. 큐를 점유하는 워커가 아니라 **짧은 동기 요청을 받는 내부 HTTP 서버**다. 이전 초안의 이름 `worker-llm`은 큐 워커로 오해되므로 쓰지 않는다.

| 항목 | 내용 |
|---|---|
| 실체 | Python 3.11 venv + FastAPI + uvicorn 프로세스(`serving/llm_server/`), pm2 이름 `llm-server` |
| 주소 | `127.0.0.1:8200` — 내부 전용. nginx가 외부로 내보내지 않음(BR-SRV-04) |
| 하는 일 | ① 허용 입력 검사(BR-CAP-01) ② 프롬프트 조립 ③ M6 호출 ④ 규칙 검사·재생성(최대 2회)·템플릿 낮춤 — `caption/` 패키지(C) ⑤ 통과 문장만 응답(BR-CAP-07) |
| 모델 | **M6 = Qwen3-4B** (Alibaba Qwen, 원본 체크포인트 `Qwen/Qwen3-4B`, 매개변수 약 4.0B, 텍스트 전용). 서빙 형식은 **GGUF 4비트 양자화 Q4_K_M**(Ollama 태그 `qwen3:4b`). **thinking 모드 끔**(`think: false`) — 짧은 설명에 추론 과정 문장이 섞이지 않게 함. 세부는 R-22 |
| 모델 실행기 | Ollama(네이티브, `127.0.0.1:11434`)는 **실행기일 뿐 모델이 아니다**. `llm-server`는 Ollama의 유일한 호출자이고, 모델은 매니페스트에 적힌 태그·다이제스트로만 부른다(태그 `latest` 금지). 과정 제공 LLM(U3)이 확인되면 `LlmPort` 구현만 바꿈 |
| 경로 | `POST /v1/caption`(설명 생성), `GET /v1/ready`(Ollama·모델 활성 버전·라이선스). 외부 API가 아님 |
| 호출자 | ① app-api — 보호자 설명 초안(UC10, `/v1/artworks/{id}/captions`) ② model-api — 외부 `caption` 기능(UC12, P0.5)을 **동기 프록시** ③ 평가 실행기 — M6 평가(UC9) |
| 동시 처리 | 1건(세마포어), 대기는 요청 쪽 시간 상한 안에서만. 시간 상한 30초 `[추론 U6]` |
| 왜 따로 두나 | FR-25 "한 서빙의 적체·장애가 다른 서빙을 막지 않는다". model-api(외부 트래픽)·워커(비전)와 프로세스를 나눠 LLM 지연이 번지지 않게 함 |
| 구간 | **P0에서는 띄우지 않는다**. `/ready`에서 M6는 `inactive_tier`(비활성 P0.5). P0.5 착수 시 pm2에 추가 |

**작업 기록과의 관계(BR-API-02)**: 전달 방식만 동기 HTTP이고 기록 계약은 다른 서빙군과 같다. app-api가 호출 전에 `stage_job(stage='caption', serving_group='llm', state='running', attempt=1)`을 만들고, 응답 `outcome`(`ok`·`engine_down`·`timeout`·`model_not_ready`)으로 같은 행을 닫는다. 인프라 오류는 app-api가 짧게 재시도(첫 시도 포함 최대 3회, D1)하고 시도마다 `attempt`를 올린다. 규칙 검사 재생성은 `llm-server` 안에서 일어나며 `stage_job` 시도로 세지 않고 `caption.generation_count`·`rule_fail_count`로 센다. 삭제(EXT1)는 app-api가 HTTP 요청을 끊고(AbortController), `llm-server`는 클라이언트 연결 종료를 감지해 Ollama 스트림을 멈춘다 → `cancelled`.

- **Rationale**: 설계 원천이 LLM 서빙을 "짧은 동기 또는 스트리밍"(BR-SRV-01, SD_01 P4 4.4)으로 정했으므로 큐 워커로 만들면 원천과 어긋난다. 동기 서버로 두되 기록은 `stage_job`에 남겨 모델별 지표(p95·재시도율)를 다른 모델과 같은 방식으로 계산한다.
- **Alternatives considered**: (a) 큐 워커 `worker-llm`으로 비동기 처리 — 보호자 화면이 폴링해야 하고 원천의 "동기"와 어긋남. (b) model-api 안의 내부 경로로 처리(이전 llm-contract 초안) — 외부 트래픽과 LLM 지연이 한 프로세스를 공유해 FR-25 격리 위반. (c) app-api가 Ollama를 직접 호출 — 규칙 검사(Python `caption/`)를 Node로 옮겨야 하고 BR-MDL-02(모델 import·직접 호출 금지) 정신에 어긋남.
- P0 구현 범위 밖이지만, P0 스키마에 `caption` 테이블과 `/captions` 경로를 404로 예약해 P0.5 착수 시 계약을 바꾸지 않는다.

## R-19. 시험 전략

- **Decision**:
  - 웹: Vitest + Vue Test Utils(컴포넌트), Playwright(모바일 390px·데스크톱 1440px, SD_02 확인 너비).
  - 앱 API: Vitest + Supertest, **실제 MariaDB**(로컬 Homebrew MariaDB 12의 `uam_test` 스키마, 없으면 팀 DB에 `t_` 접두 스키마를 쓰지 않고 로컬만 허용). 트랜잭션 롤백으로 격리.
  - Python: pytest. 어댑터마다 `FakeAdapter`(환경변수 `UAM_FAKE_MODELS=1`)가 지정한 분류(`quality_below`, `engine_down`, `timeout`, `storage`, `db`, `model_not_ready`)를 돌려주게 해 **장애 주입 시험**(spec SC "원인 분리 정확도", `docs/B_통합시험.md`)을 모델 없이 돌린다.
  - 계약 시험: `contracts/openapi.yaml`로 요청·응답을 검증(`express-openapi-validator` 응답 검증 모드는 시험에서만).
- **Rationale**: 모델 재현(U6·U14)이 끝나기 전에도 B·C가 전체 흐름을 검증할 수 있게 한다.

## R-20. 디자인 시스템 적용

- **구현 기준 파일(사용자 지시, 2026-09-28)**: 웹 구현 때는 **`/Users/pioneer1/project2610/design/style-guide/스타일가이드_우리아이미술관.html`** 을 참조한다(토큰·컴포넌트 클래스·반응형 기준점의 실물). 보조 문서는 같은 폴더의 `스타일가이드_메뉴얼_우리아이미술관.md`·`DESIGN.md`. 단 아래 충돌 해결 두 가지(제안 미리 선택 금지, 문구는 SD_02 우선)는 HTML보다 앞선다.
- **Decision**: `design/style-guide/`의 토큰(`--color-*`, `--r-*`, `--s-*`, `.t-*`)을 `web/src/styles/tokens.css`로 그대로 옮긴다. 컴포넌트는 SD_02의 C1~C10을 Vue 컴포넌트로 만든다(`JourneyRail`, `BlockNotice`, `ReasonButton`, `ArtworkTable`, `SideBySide`, `DowngradeNote`, `StoryCard`, `ValidatedField`, `RoleHeader`, `ModelStatusChip`). 글꼴은 **자체 호스팅**(`@fontsource/inter`, `pretendard` npm) `[추론 — 스타일가이드 미해결 "CDN vs 서버"]`.
- **충돌 해결**: 스타일가이드 HTML의 제안 선택지 미리 선택(`aria-pressed="true"`)은 SD_02 UX2·BR-SUG-03(기본 선택 없음)에 따라 **따르지 않는다**. 문구가 SD_02와 스타일가이드 메뉴얼에서 다를 때(예: `처리하지 못함` vs `처리하지 못했어요`)는 **SD_02를 따르고** `web/src/copy/ko.ts` 한 곳에 모아 U10 확정 시 한 파일만 바꾼다.
- 비활성 버튼은 `disabled` 대신 `aria-disabled="true"` + 사유 문구(C3, SD_02 §17 접근성).

## R-21. 비밀 정보 관리

- **Decision**: DB 접속 정보는 `.env`(git 제외)에서만 읽는다. `.env.example`의 키 이름(`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`, `DB_PASSWORD`)을 그대로 쓰고, `SESSION_SECRET`, `STORAGE_ROOT`, `MODEL_API_INTERNAL_URL`, `UAM_FAKE_MODELS` 등을 더한다. 계획 문서·계약 문서에는 비밀번호를 적지 않는다.
- **주의(발견 사항)**: 커밋하지 않은 작업 사본의 `Intent-Plan.md`에 DB 비밀번호가 평문으로 있다(커밋된 HEAD와 git 이력에는 없음을 2026-09-28 확인, 원격 저장소 없음). 이 파일은 git 추적 대상이라 **지금 상태로 커밋하면 비밀번호가 이력에 들어간다**. 구현 착수 전 팀에서 비밀번호 교체 또는 문서 정리 여부를 정하는 것을 권한다(이 계획은 해당 파일을 수정하지 않는다).

## R-22. 모델 구체 사양 — 무엇을 어떤 형식으로 올리는가 (FR-16, BR-MDL-01, D16)

- **Decision**: 모델은 실행기(Ollama·TorchServe·PyTorch) 이름이 아니라 **체크포인트 ID·변형·형식·실행 설정**으로 고정한다. 아래가 P0·P0.5·P1의 채택 기준값이며, 정확한 버전(커밋·리비전·다이제스트)과 SHA-256은 A가 재현할 때(`docs/A_모델재현기록.md`) `models/manifest.yaml`에 기록한다. `[추론]` 표시는 원천(REF §2)이 변형까지 정하지 않아 이 계획에서 고른 것이다.

| ID | 모델(원천 체크포인트) | 변형·형식 | 입력 → 출력 | 실행기·장치 | 라이선스 상태 |
|:--:|---|---|---|---|---|
| M1 | **BiRefNet** — `ZhengPeng7/BiRefNet` (Hugging Face) | 일반용 가중치, FP32 PyTorch `[추론]`. 입력 1024×1024로 리사이즈, 출력 마스크를 원본 크기로 복원 | 원본 → 1채널 마스크 PNG + RGBA 컷아웃 PNG | PyTorch, CPU(`worker-cpu`) | MIT 계열 — 확정 기록 필요(U4 목록 밖) |
| M2 | **OpenCLIP** — 아키텍처 `ViT-B-32`, 사전학습 가중치 `laion2b_s34b_b79k` `[추론]` | FP32 PyTorch. 제로샷 레이블 4종 "a child's drawing of a person / an animal / a house / an object"(프롬프트 원문은 `serving/config/m2_prompts.yaml`), 태그 후보는 같은 방식의 고정 어휘 목록 | 원본(또는 컷아웃) → 종류 1개 + 태그 후보(점수는 기록만) | open_clip_torch, CPU | **가중치 라이선스 확인 전 비활성**(U4, A2, BR-MDL-07) |
| M3 | **Meta Animated Drawings** — `facebookresearch/AnimatedDrawings` (2025-09-03 보관 처리) | 저장소 커밋 고정, TorchServe 모델 2종 `drawn_humanoid_detector.mar`·`drawn_humanoid_pose_estimator.mar`, 모션은 저장소 기본 모션 1종 `[추론]` | 원본 → 관절(판정용) / 리깅·렌더 GIF → 워커가 MP4 변환 | TorchServe(네이티브, 보관 처리) + Java 17, CPU | MIT — 보관 처리 엔진은 내부망 격리(BR-MDL-06) |
| M4 | **규칙**(모델 아님) — 관절 기하 규칙 | `serving/config/m4_rules.yaml` 파일 해시를 버전으로 | M3 관절 → 통과/불통과(팔다리 길이·좌우 대칭·몸통 비율) | Python, CPU | 해당 없음 |
| M5 | **Depth Anything V2 Small** — `depth-anything/Depth-Anything-V2-Small-hf` (약 24.8M 매개변수) | FP32 PyTorch(transformers). Base·Large는 비상업이라 **쓰지 않음** | 컷아웃 → 상대 깊이맵 16bit PNG | PyTorch, GPU(없으면 CPU, Apple Silicon은 MPS 시도) | Apache-2.0 |
| M6 (P0.5) | **Qwen3-4B** — `Qwen/Qwen3-4B` (약 4.0B 매개변수, 텍스트 전용) | **GGUF Q4_K_M**(Ollama `qwen3:4b`, 파일 2.5GB), `think: false`, `temperature 0.3`, `num_predict 160`, `num_ctx 2048` `[추론]` | 허용 입력 JSON → 2~3문장 한국어 설명(llm-contract.md) | Ollama(네이티브) via `llm-server`, Apple Silicon은 Metal / 팀 서버는 U2 | 모델 카드 기준 Apache-2.0이나 **팀 확정 기록 전 비활성**(U4) |
| M7 (P1) | **TripoSR** — `stabilityai/TripoSR` | FP16/FP32 PyTorch, 출력 메시를 GLB로 내보내기 | 컷아웃 → GLB | PyTorch, **GPU 필수**(없으면 비노출, D10) | MIT. 대안 TRELLIS는 의존성 라이선스 확인 전 비활성 |

- **고정 방법(BR-MDL-01)**: Hugging Face 체크포인트는 리비전(커밋 해시)과 가중치 파일 SHA-256, Ollama 모델은 `ollama show qwen3:4b --modelfile`의 `FROM` 블롭 다이제스트(sha256)를 `weights_sha256`으로 기록한다. 실행 설정(해상도·프롬프트·생성 매개변수·규칙 파일)은 `config_hash`에 넣는다. 매니페스트에 없는 태그·리비전으로는 실행하지 않는다.
- **가중치 크기(2026-09-28 확인, Hugging Face 파일 목록·Ollama 태그 페이지·GitHub 릴리스)**: 서버 적재 시 메모리는 최소 이 크기만큼 잡히고, 실행 중에는 더 잡힌다. 실행 중 메모리는 M3 말고는 아직 재지 않았다. 팀 서버에서 하나씩 올려 재고 `models/manifest.yaml`에 기록한다.

  | ID | 파일 | 크기 | 실행기 | 실행 중 메모리 |
  |:--:|---|--:|---|---|
  | M1 | `ZhengPeng7/BiRefNet` `model.safetensors` | 444MB | PyTorch(`worker-cpu`) | 미측정 |
  | M2 | `laion/CLIP-ViT-B-32-laion2B-s34B-b79K` `open_clip_model.safetensors` | 605MB | open_clip(`worker-cpu`) | 미측정 |
  | M3 | `drawn_humanoid_detector.mar` + `drawn_humanoid_pose_estimator.mar` | 327MB + 375MB = 702MB | TorchServe(네이티브) | RAM 약 3.1GB(1차 실측) |
  | M5 | `depth-anything/Depth-Anything-V2-Small-hf` `model.safetensors` | 99MB | PyTorch(`worker-gpu`) | 미측정 |
  | M6 | Ollama `qwen3:4b`(Q4_K_M) | 2.5GB | Ollama | 2.9GB(`num_ctx 2048`, 적재 2.9초, Studio-B 실측) |
  | M7 | `stabilityai/TripoSR` `model.ckpt` | 1,677MB | PyTorch(`worker-gpu`) | 미측정 |

  - 합계: P0(M1·M2·M3·M5) 약 1.85GB, P0.5까지 약 4.35GB, P1까지 약 6.0GB.
  - Ollama에 올라가는 건 M6 하나다. Ollama는 LLM 전용이라 M1·M2·M5·M7은 파이썬 워커가 직접 불러오고, M3는 TorchServe가 불러온다.
  - M6는 반드시 4비트 태그를 쓴다. 같은 4B라도 Q8_0은 4.3~4.4GB, FP16은 8.1GB다.
  - Ollama 기본 `keep_alive`는 5분이다. 그 뒤에는 모델을 내리고, 다음 요청이 다시 적재 시간을 기다린다. 설명 30초 상한을 지키려면 `llm-server` 기동 때 한 번 불러 두고 `keep_alive`를 늘릴지 T-02 측정 뒤 정한다.
  - 크기가 가장 큰 건 모델이 아니라 M3 실행 환경이다. 1차 설치가 디스크 32.9GB, RAM 3.1GB였다. 팀 서버 디스크·RAM 여유를 먼저 확인한다.
  - Studio-B 실측(2026-09-28): 로컬 `qwen3:4b`(블롭 `359d7dd4bcda`)는 `think: false`를 줘도 답에 추론 문장("Okay, I need to…")이 섞여 `num_predict 160`을 다 썼다. `qwen3:4b-instruct-2507-q4_K_M`로 같은 시험을 해 보고 평가로 정한다.
  - 더 가벼운 변형: M1 `ZhengPeng7/BiRefNet_lite` 178MB. 생각 모드가 아예 없는 M6 `qwen3:4b-instruct-2507-q4_K_M` 2.5GB가 있는데, 원천 체크포인트가 `Qwen/Qwen3-4B-Instruct-2507`로 바뀐다. 둘 다 채택하지 않았다. 바꾸려면 평가를 거쳐 승격한다(BR-MDL-01).
- **Rationale**: 같은 이름이라도 변형(Small/Base, 양자화 수준, thinking 여부)에 따라 품질·속도·라이선스가 달라진다. 매니페스트·평가 묶음·승격이 "무엇을 평가했는가"를 가리키려면 체크포인트 수준으로 고정해야 한다.
- **Alternatives considered**: M6를 FP16 원본(약 8GB)으로 올리는 안 — CPU·저사양 서버에서 설명 30초 상한을 넘길 위험. Q8_0 — 품질 여유는 있으나 메모리 약 2배. 1차 평가(설명 입력 세트)에서 Q4_K_M 규칙 검사 실패율이 높으면 Q8_0으로 바꿔 재평가·승격한다. M2를 `ViT-L-14`로 — 정확도는 오를 수 있으나 CPU 판정 시간이 늘어 U6 측정 뒤 결정.

## R-23. 메일 발송 (D18 결정 ⑤, U19 일부)

- **Decision**: 메일은 app-api가 **nodemailer**(SMTP)로 보낸다. **P0 발송처는 로컬 Mailpit**(Homebrew `brew install mailpit`, 네이티브 실행, Docker 없음, SMTP `127.0.0.1:1025`, 웹 수신함 `127.0.0.1:8025`) — 실제 사람에게 나가지 않는다. 실제 발송 제품·발신 주소는 U19로 남기고 `MAIL_SMTP_URL`·`MAIL_FROM` 환경 변수만 바꿔 교체한다.
  - 메일 종류 4개: 가입 확인 링크 · "이미 가입돼 있어요" 안내(결정 ④) · 로그인 정보 찾기(아이디 + 재설정 링크) · 확인 전 계정의 확인 메일 재발송. 가족 정보(별칭·작품)를 넣지 않는다(FR-32).
  - 발송은 요청 트랜잭션 커밋 뒤 비동기(프로세스 안 작은 큐, 실패 시 1회 재시도 `[추론]`). 응답(202)은 발송 성공 여부와 무관하게 같다(가입 여부 비노출).
  - 로그에는 메일 종류·결과 코드만. 수신 주소·토큰·링크는 남기지 않는다(BR-PRV-01).
- **Rationale**: 결정 ⑤(B 선정, P0는 Mailpit). 팀 내부 검증 단계에서 실제 발송 서비스 계약·도메인 인증(SPF/DKIM) 없이 흐름을 끝까지 시험할 수 있다.
- **Alternatives considered**: Gmail SMTP(개인 계정 자격 증명 공유 필요, 발송 한도), 상용 발송 API(계약·키 필요 — U19 확정 뒤).

## R-24. 보호자 가입·확인·찾기·재설정 (FR-31·32, UC13·UC14, G26·G27, D18)

- **Decision**:
  - 경로 7개(결정 ③): `POST /v1/auth/signup`(항상 202) · `/email/verify`(204 / 400 `token_invalid`) · `/email/verify/resend`(항상 202) · `/login`(204 / 401 / 403 `email_unverified` / 429) · `/logout`(204) · `/recovery`(항상 202) · `/recovery/reset`(204 / 400 `token_invalid`).
  - 가입: 한 트랜잭션에서 `family` + `guardian_account` + `auth_email_token(verify)`. 이미 있는 `email_norm`이면 계정을 만들지 않고 안내 메일만(결정 ④). 동시 가입은 `uq_guardian_email`이 최종 판정 — 중복 키 오류도 같은 202로 흡수.
  - 토큰: 32바이트 난수(base64url)를 링크에 담고 DB에는 SHA-256만(`token_hash`). 유효 시간 확인 24시간·재설정 1시간 `[예시값 U19]`. 사용 시 `used_at`, 재발급 시 같은 계정·목적의 이전 토큰 `revoked_at`(`ix_token_account_purpose`). 만료·사용·무효는 구분 없이 `token_invalid`. 시각은 모두 UTC(`UTC_TIMESTAMP()`).
  - 재설정: `password_hash`·`password_changed_at` 갱신 + 그 계정의 `app_session` 전부 삭제(현재 세션 포함, 결정 ⑥). 요청마다 세션 `created_at < password_changed_at`이면 401.
  - 요청 한도(보완 S7 `auth_rate_event`): 같은 이메일 10분 3회 · 같은 IP 1시간 20회 `[추론 예시값]`(signup·resend·recovery). 넘으면 메일을 보내지 않고 응답은 그대로(가입 여부 비노출). 로그인 실패는 같은 이메일 15분 10회 뒤 429 `[추론]`. 이메일·IP는 HMAC-SHA256으로만 저장.
  - 비밀번호 규칙: 8자 이상 `[예시값 U19]`, 흔한 비밀번호 목록 거절은 U19 뒤.
  - 로그인 타이밍: 계정이 없어도 argon2 검증을 한 번 수행해 응답 시간으로 가입 여부가 드러나지 않게 한다.
- **Rationale**: FR-31·32 수용 기준과 결정 ③④⑥을 그대로 옮겼다. 원문 이메일·토큰을 저장·로그하지 않아 BR-PRV-01·BR-ACC-07·08을 지킨다.

## R-25. 공동 보호자 (U1 확정, UC15, G28·G29, BR-ACC-09)

- **Decision**: 경로 7개 + 가족 없는 계정용 2개(`GET /v1/me`, `POST /v1/family` 새 가족 만들기 — U20 P0 기본값, `[추론]`) — `GET/POST /v1/family/invites`(POST 항상 202) · `DELETE /v1/family/invites/{id}`(204) · `POST /v1/family/invites/accept`(204 / 400 `token_invalid` / 403 `invite_email_mismatch` / 409 `already_in_family`) · `GET /v1/family/members` · `DELETE /v1/family/members/{id}`(204 / 403 만든 보호자 아님) · `POST /v1/family/leave`(204 / 409 만든 보호자).
  - **보호자는 부모 두 명까지**(만든 보호자 1 + 공동 보호자 1), **초대는 만든 보호자만**(1c460b0 사용자 결정, 넷플릭스 계정 공유 기준). 공동 보호자의 초대는 403 `invite_owner_only`, 자리가 차면 409 `co_guardian_full`. DB가 강제한다(`uq_guardian_co_family`, `uq_invite_one_pending`, `trg_family_invite_bi`).
  - 초대는 계정이 아니라 이메일에 건다(`family_invite`, 토큰 해시, 7일 `[예시값]`, 대기 초대는 가족당 1건 — 새로 초대하면 이전 초대 무효). 초대 메일은 요청 한도 대상(`auth_rate_event.action='invite'`, 같은 가족 하루 20건·같은 이메일 하루 3건 `[추론 예시값]`).
  - 수락(G28): 토큰 유효 + 로그인 계정 이메일 = 초대 이메일 + 다른 가족 미소속. 초대 링크로 가입하면 새 가족 없이 합류하고 확인 메일을 생략한다(UC13 A4, 초대 메일 수신이 주소 확인을 겸함 `[추론]`).
  - 권한: 공동 보호자는 초대·해제를 빼고 만든 보호자와 같다(아이·작품·확정·결정·이야기·설명·삭제). 두 보호자의 동시 결정은 `uq_dc_round`로 첫 결정만(BR-APR-06).
  - 해제·나가기(G29): `family_id=NULL` + 그 계정의 `app_session` 즉시 전부 삭제. 가족 소속은 세션에 캐시하지 않고 요청마다 DB에서 확인. 올린 자료는 가족 공간에 남는다.
- **Rationale**: clarify 결정(넷플릭스식 — 해제는 만든 보호자만, 공동 보호자는 나가기만)과 FR-9 "즉시 접근 불가"를 세션 무효화로 보장한다.

---

## 남은 미해결 (이 계획에서 닫지 않음)

| # | 상태 | 이 계획의 처리 |
|:--:|---|---|
| U1 | **닫힘(clarify)** | 공동 보호자 초대·같은 권한, 감상 전용 없음(`ee62c57`). 구현은 R-25 |
| U20 | 일부 | 만든 보호자 탈퇴·권한 이전은 열림. 가족 없는 계정 재로그인은 P0 기본값 `[추론]`: 자동 생성 없이 "초대 대기 / 새 가족 공간 만들기" 중 선택 |
| U2 | 열림 | GPU 없으면 M5는 CPU(Apple Silicon은 MPS 시도), M7 비노출. 설정 `gpu.enabled` |
| U3 | 열림 | 기본 Ollama 자체 호스팅. P0.5 착수 전 |
| U4 | 열림 | `license_status` 확인 전 활성 금지로 코드에서 강제 |
| U5 | 열림 | 임계값을 `serving/config/thresholds.yaml`로 두고 평가 1차 측정 뒤 채움. 그 전에는 어댑터가 "명백한 실패"(마스크 면적 0, 인물 미검출, 렌더 파일 없음, 깊이맵 분산 0)만 `quality_below`로 낸다 `[추론]` |
| U6 | 일부 | 움직임 렌더 10분만 원천. 나머지 시간 상한 기본값 `[추론]`: 분리 60초·판정 120초·깊이 180초(CPU 600초)·설명 30초. 재현 뒤 교체 |
| U7 | **닫음** | R-01 |
| U8 | **닫음** | R-08(인증), R-10(경로·형식), R-12(폴링). 포트: app-api 3000, model-api 8100, TorchServe 8080~8082, Ollama 11434(모두 127.0.0.1) |
| U9 | **닫음** | R-07 |
| U10 | 열림 | 문구를 `web/src/copy/ko.ts`로 모음. 제안 지연 시 화면은 SD_02 S3(`[나중에 고르기]`, G7 문구) 채택 |
| U11 | 열림 | P0.5 착수 전 |
| U12 | 예시값 적용 | R-09. 팀 밖 키는 확정 전 발급 금지 |
| U13 | 열림 | P0는 팀원 작품만 |
| U14 | 열림 | `MODEL_ROOT` 환경변수, 매니페스트 `file_path` |
| U15 | 열림 | P0 범위 밖 |
| U16 | 열림 | P0.5 착수 전 |
| U17 | **닫음** | R-11 |
| U18 | **닫음** | R-10 |
| U19 | 일부 | 메일 발송(Mailpit + nodemailer, R-23)·요청 한도·토큰 유효 시간은 예시값으로 시작(R-24). 실제 발송 제품·발신 주소·비밀번호 규칙·재가입 정책은 운영 전 확정 |
