# 팀 서버 배포 절차 (T140, research R-02, quickstart §7)

> Docker 없음. 호스트 네이티브 프로세스를 pm2로 띄우고 Homebrew nginx가 HTTPS·라우팅을 맡는다. GitLab CI는 검사만 한다(배포하지 않는다).
> 비밀번호·키 원문은 이 문서와 커밋에 적지 않는다. 모두 서버의 `.env`(git 제외)에만 둔다.
> 팀 서버 사양·GPU·모델 경로(U2·U14)는 `docs/A/A_팀서버_자원확인.md` 확인 뒤 표시된 칸을 채운다.

## 1. 한 번만: 서버 준비

| 항목 | 명령 | 확인 |
|---|---|---|
| Node 22 LTS · pm2 (D23) | `brew install node@22 && npm i -g pm2` | `node -v` → v22 이상(팀 서버 v25도 됨) |
| Python 3.11 | `brew install python@3.11` | |
| nginx · mailpit | `brew install nginx mailpit` | P0 메일은 Mailpit(R-23) |
| 저장소 | `git clone <gitlab>/project2610 ~/project2610` | 원본 한 곳에서만 운영(파생 폴더 없음) |
| 저장 영역 | `mkdir -p /srv/uam/store/{family,tmp,ext,evalset} /srv/uam/web/dist` · 소유자는 pm2 실행 계정, 모드 750 | R-06 |
| `.env` | 저장소 루트에 `.env.example`을 복사해 채운다 | `DB_*`·`SESSION_SECRET`·`AUTH_HMAC_SECRET`(각각 `openssl rand -hex 32`)·`STORAGE_ROOT`·`MODEL_ROOT`[U14]·`GPU_ENABLED`[U2]·`MODEL_MANIFEST`·`API_GUIDE_TEST_KEY`(아래 4) · 운영 `APP_BASE_URL=https://<도메인>:9501`(메일 링크 기준, nginx 입구 D19) |
| Python 가상환경 | `cd serving && python3.11 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.lock -r requirements-models.lock` | M3는 `.venv-m3` + TorchServe(A 문서) |
| DB 스키마 | `cd api && npm ci && npm run build && npm run db:migrate` | `0001_sd03_baseline`(= `design/uri_gallery_ddl.sql`) 재실행 안전. **팀 DB에 시험을 돌리지 않는다**(시험은 임시 MariaDB) |
| 팀원 계정 | `npm run ops:staff -- add --email <메일> --role operator[,evaluator,integrator]` (비밀번호는 표준 입력) · 역할 `grant`/`revoke --email <메일> --role <역할>` · 정지·해제 `disable`/`enable --email <메일>` · 비밀번호 `passwd --email <메일>`(표준 입력) · 목록 `list`(D24 ③). 정지·비밀번호 변경은 그 팀원 세션을 모두 지운다. 역할 회수·정지는 다음 요청부터 반영된다 | G1 · BR-ACC-05 |
| 3D 노출(P1, D10·G17) | `npm run ops:feature -- status sculpture_exposure` · 켜기 `… enable sculpture_exposure --by <운영자 이메일>`(서비스 운영자만, **M7 활성 버전이 없으면 거부**) · 끄기 `… disable …`(언제나). 다음 요청부터 반영 — 재시작 불필요 |
| 모델 버전 | `cd serving && .venv/bin/python -m ops.models check <Mx>` → `digest <Mx> --write`(실행 환경 다이제스트, R-03·SD_04 §9-2) → `register <Mx> --label …`이 출력한 JSON 본문으로 평가 담당이 `POST /v1/admin/models/<Mx>/versions`(G1) → 평가·승격은 운영 화면(S11). CLI는 DB에 쓰지 않는다 | G21·G22 |

## 2. 매번: 배포

```bash
ssh <team-server> 'cd ~/project2610 && git pull --ff-only \
  && (cd api && npm ci && npm run build && npm run db:migrate) \
  && (cd web && npm ci && npm run build) \
  && rsync -a --delete web/dist/ /srv/uam/web/dist/ \
  && (cd serving && .venv/bin/pip install --require-hashes -r requirements.lock) \
  && pm2 reload ops/ecosystem.config.cjs && pm2 save'
```

- `pm2 reload`는 app-api를 무중단으로 바꾼다. 워커는 `kill_timeout 10000` 안에 진행 중 작업을 끝내거나, 끝내지 못하면 sweeper 이어받기(BR-PRC-05)가 다시 잡는다.
- P0.5 llm-server는 설명 기능을 열 때만: `pm2 start ops/ecosystem.config.cjs --only llm-server`(주석 해제 뒤) + `.env`에 `CAPTION_ENABLED=true`. 공유 Ollama는 `http://127.0.0.1:11434`(IPv4)로만 부른다.

## 3. 배포 뒤 확인

```bash
curl -s https://<도메인>:9501/live                       # {"status":"live"}
curl -s https://<도메인>:9501/ready | jq                 # {"status":"ready","anyLoading":…} — 공개 응답엔 모델 상세 없음
pm2 status                                          # app-api · model-api · worker-cpu · worker-gpu · sweeper online
curl -s -o /dev/null -w '%{http_code}\n' https://<도메인>:9501/v1/models/segment -X POST   # 401 (키 없음 — 외부 경로 살아 있음)
curl -s -o /dev/null -w '%{http_code}\n' https://<도메인>:9501/internal/ready              # 404 (nginx가 내부 경로를 내보내지 않음)
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://<도메인>:9501/model-api/health  # 404 application/problem+json (웹 화면 200이면 잘못)
```

운영 화면(S11)의 모델 상태 표에서 M1·M2·M3·M5가 `ready`인지 본다. `loading`은 오류가 아니다(A `docs/A/A_모델적재_화면요구.md`).

## 4. 키와 비밀 정보

- API활용 시험 호출 키: `cd api && npm run ops:key -- issue --kind test` → 출력된 `uam_…` 원문을 서버 `.env`의 `API_GUIDE_TEST_KEY`에 넣고 `pm2 reload app-api`. 원문은 이때 한 번만 보인다.
- 팀 내부 키: `--kind team_internal` · 과정 키: `--kind course_internal`. `external`은 U12(한도·약관) 확정 전 발급하지 않는다(D17).
- 폐기: `npm run ops:key -- revoke --id <번호>` · 목록: `npm run ops:key -- list`(원문·해시 없음).

## 5. 되돌리기

```bash
ssh <team-server> 'cd ~/project2610 && git checkout <이전 커밋> && (cd api && npm ci && npm run build) && (cd web && npm ci && npm run build) && pm2 reload ops/ecosystem.config.cjs'
```

- DB 스키마는 되돌리지 않는다(마이그레이션은 추가만, 재실행 안전). 스키마를 바꾸는 배포는 먼저 `mariadb-dump`로 백업한다(백업 보존 정책은 U15).
- 모델 문제는 코드 되돌리기가 아니라 운영 화면의 **롤백**(롤백 후보로 즉시) 또는 **비활성화**(후보 없을 때)로 처리한다(D5).

## 6. 이번 배포 기록

| 날짜 | 커밋 | 한 사람 | 결과 |
|---|---|---|---|
| 2026-09-29 | main(§7 구성) | A 최호준 | Studio-B, https://p1.sumzip.com — pm2 8개(app-api·model-api·worker-cpu·worker-gpu·sweeper·p1-nginx·mailpit·torchserve) online, 팀 DB 마이그레이션(테이블 35+1·트리거 15), `/live`·`/ready`·`/openapi.json` 200, `/v1/models/segment` 401, `/internal/*` 404. 모델은 U4 확정 전 비활성. 호스트 재부팅 뒤 자동 기동(`pm2 startup`)은 관리자 권한이 필요해 미설정 — 재부팅 뒤 `pm2 resurrect` |
| 2026-09-29 | 9b5f637(웹) | A 최호준 | 첫 화면을 프로토타입에서 **main 웹 빌드**로 교체(`ops/p1/deploy-web.sh`). 웹은 공통 기반 단계(라우터·가드·레이아웃, 각 화면은 담당 작업 번호 자리 표시) — `/` → `/app` → `/v1/me` 401 → `/app/login`, `/ops/*` → `/v1/ops/me` 401 → `/ops/login`. 화면이 main에 더해지면 `ops/p1/deploy-web.sh`를 다시 실행 |

## 7. p1.sumzip.com 구성 (2026-09-29, A 최호준 — 첫 배포)

Studio-B(192.168.0.19)의 공유 Homebrew nginx(다른 계정 소유, `servers/p01.conf`)가 `https://p1.sumzip.com`의 TLS를 풀고 `http://192.168.0.19:9501`로 넘긴다. 공유 nginx 설정은 고치지 않는다. 그래서 팀 입구 9501(D19)은 **pioneer1 계정의 nginx 인스턴스**가 평문 HTTP로 연다(§1의 `ops/nginx.conf`는 9501에서 TLS를 직접 여는 단독 서버용).

| 구성 | 값 |
|---|---|
| 입구 | `ops/p1/nginx.conf` — `listen 9501`(평문), `set_real_ip_from 192.168.0.19` + `real_ip_header X-Forwarded-For`로 실제 접속 IP를 앱에 넘긴다(요청 한도 G26·G27) |
| 첫 화면 `/` | **main에서 implement한 웹 빌드(`web/`)만 올린다. SD_02 클릭 프로토타입(`design/prototype`)은 절대 연결하지 않는다**(2026-09-29 최호준 지시). 공유 작업 폴더의 `web/`에는 커밋 전 작업이 섞이므로, `ops/p1/deploy-web.sh`가 main 커밋을 `git archive`로 `.data/p1-build/`에 풀어 `npm ci && npm run build`하고 결과를 `.data/p1-web/`에 바꿔 넣는다. nginx `root`는 `.data/p1-web`, SPA라 없는 경로는 `index.html`로 보낸다. 어느 커밋을 올렸는지는 `.data/p1-web/DEPLOYED_COMMIT`에 남긴다 |
| 사진 자산 | `/museum/photos/` 1년 immutable 캐시, `manifest.json`은 no-cache, 없는 파일은 SPA로 떨어지지 않고 404(SD_04 §3-3 사진 자산) |
| API | `/v1/*`·`/live`·`/ready`·`/openapi.json` → app-api 9521, `/v1/models/*` → model-api 9541(`location ^~` — 정규식 location보다 먼저 잡혀야 한다. §1 `ops/nginx.conf`도 같은 수정 필요), `/internal/*` 404, `/model-api`·`/model-api/*` 404 problem+json, 본문 상한(`client_max_body_size 21m`) 초과는 nginx 기본 HTML 대신 413 problem+json(`payload_too_large`, 계약 PayloadTooLarge — 2026-09-30 점검)(SPA 대체로 떨어지지 않게 — 공개 범위 팀 결정 전, SD_04 §내부망 배치), `/metrics`는 로컬만 |
| 프로세스 | `ops/p1/ecosystem.config.cjs` — 저장소 루트 `.env`를 읽어 `ops/ecosystem.config.cjs`의 각 앱에 넣고, 입구 nginx·Mailpit·TorchServe를 더한다. `pm2 start ops/p1/ecosystem.config.cjs` |
| `.env` 추가 값 | `SESSION_SECRET`·`AUTH_HMAC_SECRET`(`openssl rand -hex 32`), `APP_BASE_URL=https://p1.sumzip.com`, `SECURE_COOKIES=true`, `STORAGE_ROOT=<저장소>/.data/store`, `MODEL_ROOT=<저장소>/models`(U14), `GPU_ENABLED=true`(U2, MPS), `UAM_FAKE_MODELS=0`(운영값), `TORCHSERVE_URL=http://127.0.0.1:9561`, `M3_AD_PYTHON=<저장소>/serving/.venv-m3/bin/python`, `M3_AD_ROOT=<저장소>/models/m3/AnimatedDrawings`(R-03). M3 환경 설치는 `docs/A/A_모델재현기록.md` M3 절 |
| 메일 | Mailpit 단일 실행 파일(`~/.local/bin/mailpit`, 공유 Homebrew에 설치하지 않음), SMTP 127.0.0.1:1025 · 화면 127.0.0.1:8025(외부 비공개) |
| DB | 팀 DB `ABC10pioneer1`에 `npm run db:migrate`(0001_sd03_baseline, 추가만·재실행 안전) |
| 모델 | 매니페스트 해시로 버전을 등록하지 않았고 라이선스 확정(U4) 전이라 모든 모델이 비활성이다. 작품은 접수되지만 모델 단계는 `model_not_ready` → 액자 경로로 간다(BR-PRC-01). 팀 확정 뒤 `ops.models register`가 만든 본문으로 app-api에 후보를 등록하고 평가·승격한다(§1) |
