# 우리 아이 미술관 마스터플랜(모델 서빙 서비스에 3D 화면을 입혀 Docker Compose로 완성하고 발표하기, 5일)

작성 2026-10-28, 고침 2026-10-29(화면을 3D 미술관으로 바꿈). 독자는 함께 작업할 팀원 3명이다. 날마다 교안의 무엇을 함께 복습하고 무엇으로 확인하는지는 `docs/공통/컨테이너배포_팀가이드.md`에 있다.

**무엇을 바꾸나(사용자 결정 2026-10-29).** 모델 서빙(app-api · 작업 큐 · 워커 · 모델 · DB)은 지난 판 그대로 쓴다. 보호자 화면만 브라우저 3D 미술관(`web/src/app/world/`, 주소 `/app/world`)으로 바꾼다. 3D 미술관은 지금 서버 없이 기기 안에서만 돈다(배경 지우기는 브라우저 규칙, 저장은 IndexedDB). 그래서 이번 작업의 개발 몫은 **3D 화면이 모델 서빙 API를 쓰게 잇는 것**이고, 나머지는 전체를 컨테이너로 감싸는 것이다.

## 1. 이루려는 것(5일)

- **핵심 하나.** `docker compose up -d` 한 명령으로 서비스가 뜬다. 3D 미술관에서 가입 → 사진 올리기 → 서버 모델이 분리(M1)·판정(M2)·결과(M5 부조 또는 액자) → 보호자가 확정 → 입체 작품이 3D 미술관에 걸리는 한 바퀴가 된다.
- **발표.** 그 한 바퀴를 실제 화면으로 시연하고, 모델 서빙을 컨테이너로 어떻게 나눴는지 설명한다(6절).
- **작업 기록.** 각자 맡은 부분을 자기 PR로 만들고, 고른 것과 버린 것을 설명할 수 있게 남긴다(7절).
- 기간이 짧아서 핵심 흐름에 필요 없는 일은 하지 않는다(10절). 시간이 남아도 범위를 늘리지 않고 발표 준비에 쓴다.
- 팀원 3명이 직접 만든다. 저장소에는 미리 만든 Dockerfile·compose 파일·연결 코드가 없다.

## 2. 지금 상태(2026-10-29 확인)

| 영역 | 사실 | 확인한 곳 |
|---|---|---|
| 모델 서빙 | app-api(Express) · sweeper · model-api(FastAPI) · 워커(Python, DB 작업 큐 `stage_job`) · MariaDB. 모델 M1 BiRefNet · M2 OpenCLIP · M5 Depth Anything V2(M3·M7은 가짜 어댑터로 둘 수 있다). 팀 서버(맥)에서 pm2로 띄웠다 | `api/` `serving/` `db/` `ops/p1/` |
| API | 가입·로그인·아이·작품 올리기·권유 확정·결과 결정·미술관 목록·파일(`contracts/openapi.yaml`, 경로 69개). 작품 상세가 M1 컷아웃 주소(`cutoutUrl`)와 결과 파일 주소를 준다 | `contracts/openapi.yaml` |
| 3D 화면 | Vue 3.5 + three.js 0.170. 작품·방·설정은 IndexedDB(`store.ts`), 배경 지우기는 브라우저 규칙(`cutout.ts`). 서버를 부르지 않는다. 서버 모델로 바꿀 자리를 나눠 두었다(`cutout.ts` 2행: `removeBackground()`·`buildRelief()`) | `web/src/app/world/` |
| 3D 화면 실행 | 개발: `cd web && npm run dev` → `http://127.0.0.1:9501/app/world`(개발 서버가 `/v1/*`를 app-api로 넘긴다). 배포본: `npm run build:world` → `web/dist-world/`. 서버로 올리려면 둘 다 `VITE_WORLD_SERVER=1`(3-3) | `web/vite.config.ts`, `web/package.json` |
| 개인정보 문구 | 3D 화면 안내 창에 "사진을 이 기기 밖으로 보내지 않아요"라고 적혀 있다. 서버로 보내게 되므로 바꿔야 한다 | `web/src/app/world/WorldPrivacy.vue` 20행 |
| 리눅스 | 리눅스 컨테이너(arm64·x86_64)에서 서빙·api 시험 통과, x86_64용 CPU 전용 모델 잠금 있음 | `serving/README.md` |
| Docker | Dockerfile·compose·`.dockerignore` 0개 | 저장소 |
| 원격 저장소 | `github.com/kids-gallery/uri-gallery`(비공개) `main` | 사용자 결정 2026-10-28·10-29 |

## 3. 만들 것(5일 범위)

### 3-1. 완성 기준

```
3D 미술관(브라우저) ──/v1/*──▶ app-api ──한 트랜잭션──▶ DB(작품 + 원본 액자 + 작업 등록)
                                                          │
                       worker-cpu ◀── stage_job 작업 표 ──┘   M1 분리 → M2 판정 → (확정 뒤) M5 부조 또는 액자
   3D 미술관 ◀── 작품 상태·컷아웃·결과 파일 ── app-api ◀── DB
```

- 사진을 올리면 원본 액자가 먼저 걸린다(서버 규칙). 서버가 M1 컷아웃을 만들면 3D 화면이 그 그림으로 입체를 다시 만든다.
- 권유 확정과 결과 결정은 3D 화면 안의 작은 창 두 개로 한다.
- 모델은 CPU로 돈다(`GPU_ENABLED=false`). 움직이는 그림(M3)·3D 조각(M7)은 가짜 어댑터(`UAM_FAKE_MODELS=M3,M7`). 설명(M6)은 끈다. 메모리가 작은 PC는 전부 가짜(`UAM_FAKE_MODELS=1`)로 같은 흐름을 돈다.
- 3D 화면의 방 배치·캐릭터·놀이·백업은 지금처럼 기기에 둔다(이번 범위 밖).

### 3-2. compose 구성(설계 PR #20에서 확정, 2026-10-30)

| 서비스 | 이미지 | 바깥 포트 | 볼륨 | 상태 확인 | 담당 |
|---|---|---|---|---|---|
| web(입구) | 빌드 단계 `node:22`(`npm run build:world`) → 실행 단계 nginx | 9501 | 없음 | `/` 응답 | 신지현 |
| app-api | api 이미지(`node:22`) | 없음 | 작품 파일 | `/live`·`/ready` | 이제민 |
| sweeper | app-api와 같은 이미지, 실행 명령만 다르다 | 없음 | 작품 파일 | 프로세스가 살아 있음 | 최호준(서비스 설정), 이제민(이미지) |
| db | MariaDB 공식 이미지(12.0 계열) | 없음 | DB 자료 | 공식 이미지의 확인 스크립트 | 최호준 |
| mailpit | Mailpit 공식 이미지 | 8025(메일 화면) | 없음 | 없음 | 최호준 |
| model-api | serving 이미지(`python:3.11`) | 없음 | 작품 파일(쓰기: 외부 요청 사진), 작업자 상태 폴더(읽기·쓰기: 워커 상태 읽기, 지금 불러오기 요청 쓰기) | `/internal/ready` HTTP 응답(자기 프로세스) | 최호준 |
| worker-cpu | model-api와 같은 이미지 + 모델 묶음, 실행 명령만 다르다 | 없음 | 작품 파일(쓰기), 작업자 상태 폴더(쓰기), 모델 가중치(읽기 전용), 모델 쓰기 캐시 | 상태 파일이 60초 안에 갱신됨 | 최호준 |

- nginx: `/`는 `dist-world` 정적 파일(없는 경로는 `index.html`), `/v1/*`·`/live`·`/ready`는 app-api, `/v1/models/*`는 model-api. 화면과 API가 같은 출처라 CORS가 필요 없다(쿠키 세션 그대로).
- 기동 순서: db 준비 → db-migrate(스키마, 개발 환경이면 모델 첫 활성까지) 완료 → app-api·sweeper·model-api·worker-cpu. 준비됨의 기준은 3-5 6번 표. 상시 서비스는 `restart: unless-stopped`, db-migrate는 `restart: "no"`. 모든 서비스 `init: true`(종료 신호 전달용이고 정상 종료를 보장하지는 않는다, 3-5 6번).
- 메일을 끄면 이메일 가입도 꺼지므로(`api/src/modules/auth/routes.ts` 66행) Mailpit을 둔다.
- 비밀 값(사용자 결정 2026-10-30): 비밀번호·키(`DB_PASSWORD`, `SESSION_SECRET`, `AUTH_HMAC_SECRET` 등)는 compose `secrets:`로 `secrets/` 폴더의 파일을 컨테이너에 넣는다(`/run/secrets/…`). 환경 변수와 달리 `docker inspect`에 값이 보이지 않는다. `secrets/`의 실제 값 파일은 `.gitignore`로 저장소에 올리지 않고, 빈 예시(`secrets/*.example`)만 올린다. 리뷰어 확인 목록(4-1)의 "비밀 값"에 이 폴더를 넣는다. 비밀이 아닌 설정(주소, 포트, 켜고 끄는 값)은 `.env`(`env_file`)로 넘긴다. MariaDB 공식 이미지는 `MARIADB_PASSWORD_FILE`을 바로 읽고, app-api는 `*_FILE` 값을 읽도록 고친다(3-4).
- **#66 리뷰 반영:** 컨테이너 예시는 APP_HOST=0.0.0.0, MAIL_ENABLED=true를 각각 한 번 둔다. TRUST_PROXY의 compose망 CIDR과 고정 subnet은 #32에서 함께 정하며, 예시의 loopback은 그 전까지 기본값으로 명시한다. 호스트 pm2 배포 문서에는 주소·저장 경로·쿠키 값을 호스트 기준으로 설정하는 절차를 분리한다.
- **#25 설정 예시:** `.env.example`은 컨테이너용 비밀이 아닌 값만 둔다. DB는 `db:3306/uam`, 메일은 `smtp://mailpit:1025`, 모델 API는 `http://model-api:9541`, 메일 링크는 `http://localhost:9501`이다. HTTP 개발에서만 `SECURE_COOKIES=false`이고 HTTPS에서는 true로 바꾼다. `secrets/db_password.example`, `session_secret.example`, `auth_hmac_secret.example`은 빈 안내 파일이며 실제 파일은 Git에서 제외한다. DB의 root 비밀번호도 개발 compose에서는 db_password 파일을 공유한다(#18 목록). API 파일 읽기는 #21, serving은 #23이 선행되어야 한다. `.env`를 프로그램이 자동으로 읽지 않으므로 로컬 개발 시험에는 환경 변수를 직접 넘긴다.
- 띄우지 않는 것: worker-gpu, TorchServe, 설명 서버.

### 3-3. 3D 화면 ↔ API 연결(이번 작업의 개발 몫, 대응표는 #19)

`store.ts`(기기 저장) 옆에 서버를 쓰는 층을 하나 두고, 작품 관련 부분만 서버로 바꾼다.

| 3D 화면 지금(기기) | 바꿀 것(app-api) |
|---|---|
| 가족·아이를 기기 안 계정으로 만든다(`Account`) | 이메일 가입·로그인(`/v1/auth/signup`·`/v1/auth/login`, 확인 메일은 Mailpit), 아이 등록·선택(`/v1/children`) |
| 사진을 기기에서 처리한다(`processImage` → 브라우저 배경 지우기) | `POST /v1/artworks`로 올린다. 원본 액자가 바로 걸린다 |
| 입체를 바로 만든다 | `GET /v1/artworks/{id}`로 상태를 본다. 컷아웃(`cutoutUrl`)이 오면 그 그림으로 입체를 다시 만든다(`buildRelief`는 그대로) |
| (없음) | 권유 확정 `POST /v1/artworks/{id}/confirm`, 결과 결정 `POST /v1/artworks/{id}/decision`: 3D 화면 안의 작은 창 두 개 |
| 작품 목록(`listArtworks`) | `GET /v1/gallery`·`GET /v1/artworks`, 파일은 `/v1/files/{token}` |
| 방 배치·설정·캐릭터·놀이·백업 | 그대로 기기에 |

- 서버에 닿지 않으면 화면에 알리고 다시 시도하게 한다. 기기 판으로 몰래 바꾸지 않는다(두 저장소가 섞이지 않게).
- 응답 타입은 OpenAPI에서 생성한 타입(`web/src/api/types.gen.ts`, `npm run gen:api`)을 쓴다.
- 개인정보 안내(`WorldPrivacy.vue`)를 바꾼다: 사진은 우리 서버로 보내 처리하고, 원본은 덮어쓰지 않으며, 아이 사진은 외부 API로 보내지 않는다.
- 서비스 워커가 `/v1/`을 캐시하지 않는지 확인한다.

**서버 연결 층(`web/src/app/world/server/`, #28).** 3D 화면의 창들은 서버를 이 층으로만 부른다.

- 새 HTTP 코드를 만들지 않는다. `/app` 화면이 쓰는 `web/src/api/client.ts`(같은 출처·쿠키 세션·Problem Details → `ApiError`)와 `web/src/app/artwork.ts`의 작품 타입을 그대로 쓴다. `loadArtwork`는 `noRedirect` 없이 부르는 `/app` 화면용이라 쓰지 않는다. 이 층에는 #19 대응표 한 줄에 함수 하나만 둔다: `signup`·`verifyEmail`·`resendVerify`·`login`·`logout`·`me`·`listChildren`·`addChild`·`uploadArtwork`·`getArtwork`·`confirmKind`·`decide`·`gallery`.
- 모든 호출은 `noRedirect`로 부른다. 401이나 409 `no_family`가 와도 `/app/login` 등으로 화면을 옮기지 않고, 3D 화면 안에서 처리한다(401은 로그인 창 #30).
- 오류는 `failureOf(e)` 하나로 세 가지로 나눠 창에 넘긴다.

| 종류 | 언제 | 창이 할 일 |
|---|---|---|
| `offline` | 서버에 닿지 않음(네트워크 실패, 5xx. 단 503 `not_saved`는 아래 `refused`) | 연결되지 않는다고 알리고 다시 시도하게 한다. 화면 글에 "서버"를 쓰지 않는다(D48). 기기 저장으로 바꾸지 않는다 |
| `login` | 401 | 로그인 창을 연다 |
| `refused` | 서버가 거절(그 밖의 4xx, `not_saved`) | 이유 문장(`problemCopy`의 `reason`, `/app`과 같은 사전)과 칸별 이유(`fields`) |

**사진 올리기(`web/src/app/world/server/upload.ts`, #31).** 올리기 창(`WorldUpload.vue`)이 서버로 사진을 보내고, 받은 원본 액자를 바로 건다.

- **켜는 값: 빌드 설정 `VITE_WORLD_SERVER=1`.** 값이 없으면 지금처럼 기기 판이다. compose의 web 이미지는 이 값으로 빌드한다(#26), 개발 서버는 `VITE_WORLD_SERVER=1 npm run dev`.
  - 고른 이유: 로그인(#30)·아이 선택(#36)·서버 전시(#40)가 끝나기 전에 전부 바꾸면 3D 화면이 그동안 쓸 수 없다. 세션이 있는지로 자동 전환하면 로그인이 풀렸을 때 기기 판으로 몰래 바뀌어 위 규칙을 어긴다. 한 빌드는 한 저장소만 쓴다.
  - 기기 판을 없애는 일은 #40 뒤에 따로 정한다.
- **요청 번호(`Idempotency-Key`):** 사진마다 UUID 하나를 만들어 다시 시도할 때도 그대로 쓴다. 서버가 UUID만 받는다. `crypto.randomUUID`는 https나 localhost에서만 되므로(#41의 `http://<IP>:9501`에서는 없음) `crypto.getRandomValues`로 대신 만든다.
- **올리기 전 안내:** JPEG·PNG·HEIC, 한 장 20MB까지. 빈 파일·큰 파일·다른 형식은 서버에 보내지 않는다. 그래도 서버가 내용을 다시 검사하므로 깨진 사진은 서버 이유 문장으로 보인다.
- **다시 시도:** `offline`·`login`과 503 `not_saved`만 다시 시도할 수 있다. 그 밖의 `refused`는 같은 사진으로 다시 해도 안 되므로 버튼을 두지 않는다. `login`은 #30의 로그인 창이 생기기 전까지 안내 문장만 보인다.
- **어느 아이의 작품인가:** `selectedChild`(#36이 정함)를 먼저 쓰고, 없으면 아이가 1명일 때 그 아이로 한다. 0명이거나 여러 명인데 고르지 않았으면 올리지 않고 안내한다. 다른 아이 작품으로 들어가는 일을 막기 위해서다.
- **원본 액자 걸기:** 202의 `photoUrl`을 받아 화면용 사본을 만들고(`processImage`, 배경 지우기 없음) 3D 화면에 건다. 서버 판은 기기 저장소의 작품을 섞지 않는다. 올린 뒤 나이·주제 질문과 돌리기 버튼도 두지 않는다(서버가 이야기를 채우고 올린 작품은 고칠 수 없다, D46). 기기에 저장한다는 안내 띠와 브라우저 배경 지우기 결과 문구도 보이지 않는다. 화면이 그리지 못하는 사진(HEIC를 못 여는 브라우저)은 서버에는 보관됐으므로 실패로 치지 않고 안내만 한다.
- [한계] 걸린 작품은 이 화면의 메모리에만 있어 새로 고침하면 사라져 보이고, 정보 고치기·지우기도 아직 서버로 가지 않는다. 서버 목록과 함께 #40에서 바꾼다. 설정·개인정보 창의 "이 기기에만 저장" 문구는 #44에서 바꾼다.

### 3-4. 컨테이너로 옮기며 고칠 코드(작게, 설계서 먼저)

| 고칠 것 | 왜 | 담당 |
|---|---|---|
| app-api 바인딩 주소를 설정 값으로(기본값은 127.0.0.1) | 코드에 고정돼 다른 컨테이너가 부를 수 없다(`api/src/server.ts` 14행) | 이제민 |
| app-api 프록시 신뢰 범위를 설정 값으로 | 입구가 다른 컨테이너가 되면 요청 한도가 모든 사용자에게 한 IP로 걸린다(`api/src/app.ts` 24행) | 이제민 |
| model-api 바인딩 주소를 설정 값으로 | 같은 이유(`serving/model_api/main.py` 8행) | 최호준 |
| 모델 묶음 잠금을 CPU 종류에 따라 고르는 빌드 인자 | 맥(arm64)과 Windows(x86_64)가 같은 Dockerfile을 쓴다 | 최호준 |
| `.gitattributes`(줄바꿈 LF) | Windows에서 셸 스크립트가 CRLF가 되면 컨테이너에서 깨진다 | 신지현 |
| app-api 시작 명령을 빌드 결과에 맞게(`package.json` `start` → `node dist/src/server.js`) | 지금 값(`dist/server.js`)은 빌드 결과에 없다(3-5 2번) | 이제민 |
| 마이그레이션 폴더를 설정 값으로(`MIGRATIONS_DIR`, 기본값은 지금 경로) | 빌드된 이미지에서 경로가 어긋난다(3-5 판정) | 최호준 |
| 개발 환경 모델 첫 활성(db-migrate, `DEV_ACTIVATE_MODELS=1`일 때만) | 새 DB에 활성 모델 버전이 없어 처리 작업이 생기지 않는다(3-5 1번) | 최호준(이제민 지원) |
| serving이 비밀 값을 파일에서도 읽게(`DB_PASSWORD_FILE`) | compose `secrets:`. 지금 `serving/common/config.py`는 환경 변수만 읽는다 | 최호준 |
| app-api가 비밀 값을 파일에서도 읽게(`DB_PASSWORD_FILE` 등, 없으면 지금처럼 환경 변수) | compose `secrets:`(3-2)는 값을 파일로 넣는다. 지금 `api/src/config.ts`는 환경 변수만 읽는다 | 이제민 |

### 3-5. 설계 PR의 답(#20, 2026-10-30, 검토 반영)

표시: [확인] 코드·실행으로 확인함, [추론] 코드에서 읽은 위험, [미검증] 해당 이슈에서 실행으로 확인한다.

1. **서비스 나누기.** 상시 서비스 7개(`restart: unless-stopped`)와 한 번 돌고 끝나는 db-migrate(`restart: "no"`)를 둔다. 같은 코드를 쓰는 둘은 이미지를 나눠 쓴다(app-api·sweeper·db-migrate = api 이미지, model-api·worker-cpu = serving 이미지). 직접 빌드하는 이미지는 web·api·serving 3개, 공식 이미지는 db(`mariadb:12.0`)·mailpit(`axllent/mailpit`).
   - **개발 환경 모델 첫 활성.** [확인] 새 DB에는 활성 모델 버전이 없다(마이그레이션에 `model_version` 시드 없음). 워커는 활성 버전이 있는 모델만 올리고(`serving/workers/runner.py` `refresh_enabled`), 앱 서버는 M1·M2·M3이 모두 활성일 때만 분리·판정 작업을 만든다(`api/src/modules/artworks/models.ts` `JUDGE_MODELS`). 그래서 db-migrate가 개발 환경일 때(`DEV_ACTIVATE_MODELS=1`) 스키마 다음에 M1·M2·M3·M5를 `active`·`license_confirmed`로 만든다. 조건은 SD_04 9-4의 D27 예외와 같고, 팀 서버·운영 DB에서는 켜지 않는다. 기존 도구(`scripts/dev_activate_models.py`)는 `DB_HOST`가 127.0.0.1이 아니면 멈추고 127.0.0.1 API를 불러 compose에 그대로 쓸 수 없다. 담당은 #33.
2. **이미지.**
   - **#24 모델 의존성 선택:** 기본 `INSTALL_MODELS=0`은 기본 잠금만 설치한다. `INSTALL_MODELS=1`일 때 BuildKit `TARGETARCH=amd64`는 `requirements-models-linux-x86_64.lock`(CPU 전용 torch), `arm64`는 기존 `requirements-models.lock`을 고른다. 지원하지 않는 CPU·설치 값은 설치 전에 실패한다. 잠금은 재생성하지 않는다. arm64 기존 잠금은 macOS 대상으로 생성됐다. wpalswpa의 PR #67 리뷰에서 Linux arm64 빌드·torch import 성공(1.63GB, torch 2.4.1 aarch64, CUDA False)이 보고됐지만, 모델 적재 호환까지 보장할 수 없다. 시험은 빌드와 torch import까지만 하고 가중치 다운로드나 실제 모델 실행은 하지 않는다.
   - **#65 리뷰 반영:** model-api는 uvicorn 기동 전에 설정을 읽어 비밀 파일 오류를 프로세스 실패로 처리한다. serving은 UID/GID 1000의 비루트 사용자로 실행한다. 앱 이미지의 `node` UID 1000과 맞춰 작품 볼륨의 상호 쓰기·삭제가 가능하도록 하며 `/data/store`, `/data/run`을 같은 사용자 소유로 만든다. 기존 볼륨 권한 변경과 호스트 비밀 파일 접근은 compose 연결 때 별도 확인한다. 기본 잠금에 포함된 pytest는 현재 이미지에도 포함되며 잠금 재생성은 하지 않는다.
   - **#23 serving 이미지:** `python:3.11.18-slim-bookworm`(실제 pull 후 Python 판 확인), 기본 `requirements.lock`을 해시 검증하여 설치한다. model-api 기본 명령은 `python -m model_api.main`, worker는 같은 이미지에서 `python -m workers.main --group cpu_vision`로 바꾼다. `MODEL_API_HOST`는 기본 127.0.0.1이고 컨테이너 간 통신 시 0.0.0.0을 명시한다. 계약과 매니페스트는 `/app/contracts`, `/app/models/manifest.yaml`, 작품과 상태는 `/data/store`, `/data/run`이다. 기본 이미지에 모델 묶음과 가중치를 넣지 않는다. `DB_PASSWORD_FILE`이 있으면 환경 변수보다 먼저 읽고 끝의 줄바꿈 한 개(LF/CRLF)만 없앤다. 읽기 실패는 기동 실패다. `.dockerignore`는 #61의 저장소 루트 파일을 재사용한다.
   - 빌드 맥락은 저장소 맨 위, `.dockerignore`는 맨 위에 하나(`node_modules`, `.env`, `secrets/`, `models/hf/`, `.data/`, 시험 결과물 제외). 의존성 파일을 먼저 복사해 설치하고 소스는 나중에. 정확한 판 번호는 각 이미지 PR에서 `docker pull`로 확인해 적는다(`latest` 금지).
   - api 이미지는 운영 의존성과 빌드 결과만 담는다. [확인] `tsx`는 개발 의존성이고 빌드 결과는 `dist/src/server.js`·`dist/scripts/migrate.js`다. 그래서 명령은 `npm run …`이 아니라 `node`로 부른다.

     | 서비스 | 명령 |
     |---|---|
     | app-api | `node dist/src/server.js`(지금 `package.json` `start`의 `dist/server.js`는 틀려서 고친다, #22) |
     | sweeper | `node dist/src/sweeper/main.js` |
     | db-migrate | `node dist/scripts/migrate.js`(`MIGRATIONS_DIR` 필요, #33) |

   - 이미지 안 경로는 저장소 구조를 따른다.

     | 무엇 | 이미지 안 경로 | 설정 값 |
     |---|---|---|
     | 앱 서버 빌드 결과 | `/app/api/dist` | |
     | SQL 마이그레이션 | `/app/db/migrations` | `MIGRATIONS_DIR` |
     | API 계약 | `/app/contracts` | `CONTRACTS_DIR` |
     | 모델 매니페스트 | `/app/models/manifest.yaml` | `MODEL_MANIFEST` |

3. **CPU 종류와 메모리.** 모델 묶음 잠금 파일은 빌드 인자로 고른다(arm64 `requirements-models.lock`, amd64 `requirements-models-linux-x86_64.lock`, #24). 기본은 전부 가짜 모델(`UAM_FAKE_MODELS=1`). 실제 모델은 [미검증]이다.
   - [확인] 워커 하나가 M1·M2·M5를 한 프로세스에 함께 올린다(`preload_all`). `limits.yaml`에 M1 CPU 추론 RSS 8.5GB가 적혀 있다. 이제민 맥의 colima 가상 머신은 CPU 6개·메모리 14GiB다. 같은 PC에서 db·api·web도 메모리를 쓰므로, 할당량만으로 실행 가능하다고 보지 않는다.
   - [확인] 최호준 PC는 메모리 7.73 GiB, WSL 3.8 GiB다(#15, 2026-10-30). WSL 한도를 늘려도 PC 전체가 M1 추론 RSS(8.5GB)보다 작아 이 PC에서는 실제 M1을 돌리지 않는다. 신지현 PC도 메모리 7.70 GiB, WSL 3.7 GiB(사용 가능 2.4 GiB)로 같다(#15). 마스터플랜 4절 대비책대로 Windows 두 대에서는 가짜 모델로 이미지·compose를 만들고, 실제 모델 실측은 맥(이제민 PC)에서 함께 한다(#43). [미검증] 가짜 모델 compose 전체도 WSL 사용 가능 메모리 2~3 GiB 안에 들어가는지는 #16·#41에서 잰다. 모자라면 `%UserProfile%\.wslconfig`의 `memory`를 늘린다(PC 전체의 절반 이상).
   - #16(Windows WSL: 가짜 모델 compose의 메모리, 가능하면 M2·M5 한 장)과 #43(맥: M1·M2·M5)에서 `docker stats` 최대치를 재서 worker 메모리 한도를 정한다.
   - [추론] 메모리가 모자라 worker가 죽으면 재시작되고, 맡던 작업은 점유 60초가 지난 뒤 다시 시도된다. 3번 실패하면 "결과 미도달"이다(`limits.yaml` `claim.seconds 60`, `retry.max_attempts 3`).
4. **데이터와 비밀 값.**

   | 저장 | 방식 | 쓰기 | 읽기 | 경로(설정 값) |
   |---|---|---|---|---|
   | DB 자료 | 이름 있는 볼륨 | db | | `/var/lib/mysql` |
   | 작품 파일 | 이름 있는 볼륨 | app-api · sweeper · worker-cpu · model-api(외부 요청 사진 `ext/`) | | `STORAGE_ROOT` |
   | 작업자 상태 | 이름 있는 볼륨 | worker-cpu(상태 파일) · model-api(지금 불러오기 요청 `warmup/`) | model-api(워커 상태) | `UAM_RUN_DIR` |
   | 모델 가중치 | 호스트 `models/hf` → `/models/hf` 읽기 전용 | 없음 | worker-cpu | `MODEL_ROOT=/models` |
   | 모델 쓰기 캐시 | worker-cpu만 쓰는 이름 있는 볼륨 | worker-cpu | | `HF_HOME` |

   - [확인] model-api는 모델을 올리지 않는다(어댑터·`from_pretrained`를 부르지 않음). 그래서 가중치와 쓰기 캐시를 붙이지 않는다. 대신 외부 요청 사진을 `STORAGE_ROOT/ext/`에 쓰고(`serving/model_api/external.py` 295행), 지금 불러오기 요청을 `UAM_RUN_DIR/warmup/`에 쓴다(`internal.py` 144행). 작품 파일·작업자 상태 볼륨은 model-api에도 쓰기로 붙인다. [미검증] 작업자 상태 볼륨의 쓰기는 #34에서 지금 불러오기 요청이 202로 응답하고, 워커가 요청을 처리해 파일을 지우는지로 확인한다.

   - [확인] 어댑터는 `from_pretrained(..., cache_dir=MODEL_ROOT/hf)`로 가중치를 읽고, M1은 `trust_remote_code`를 쓴다. [추론] 읽기 전용 캐시에 잠금 파일·원격 코드 모듈을 쓰려 하거나 네트워크로 가려 할 수 있다. 그래서 worker-cpu에 `HF_HUB_OFFLINE=1`과 쓰기용 `HF_HOME`(별도 볼륨)을 둔다. [미검증] #42에서 네트워크를 끈 상태로 세 모델이 `ready`가 되는지 확인한다.
   - 가중치는 `/models/hf`에 붙고 매니페스트는 이미지의 `/app/models/manifest.yaml`이라 서로 가리지 않는다. 가중치는 `models/manifest.yaml`의 `source`·`revision`으로 받아 호스트 `models/hf/`에 둔다(`.gitignore`).
   - 비밀 값은 `secrets:`(3-2). [확인] 앱 서버(`api/src/config.ts`)와 serving(`serving/common/config.py`)은 지금 환경 변수만 읽는다. 둘 다 `*_FILE`을 읽게 고친다: 앱 서버 #21, serving #23. db-migrate는 앱 서버 설정 코드를 쓰므로 #21로 함께 해결된다.
5. **연결.** 3-3 표의 경로와 응답 칸은 #19에 있다. 여기서는 계약에 따른 필수 동작과, B가 정할 화면 배치를 나눈다.
   - **필수 동작(C 연결 층, 계약 근거):**
     - [확인] 응답의 `state`는 처리 상태가 아니라 표시 상태다. 원본 액자가 걸린 작품은 판정 중·확정 대기에도 `exhibited`로 온다(SD_03 뷰 `v_artwork_display`). 그래서 `state`만으로 판단하지 않는다.

       위에서부터 먼저 맞는 줄 하나로 정한다. `frame`은 확정 값과 결정 값에 모두 있어서 `choices`만으로는 어느 창인지 가를 수 없다. [확인] `processing`·`awaiting_review`·`failed`는 원본 액자가 걸려 있어도 `state`에 그대로 나온다(같은 뷰). 그래서 창 종류는 `state`·`confirmedKind`로 정하고, `choices`는 그 창에 보일 버튼만 정한다. [미검증] 액자만 고를 수 있는 확정 단계와 `frame`이 있는 결정 단계에서 창이 하나만 열리는지는 #38·#39에서 확인한다.

       | 순서 | 화면 판단 | 기준 | 버튼 |
       |---|---|---|---|
       | 1 | 결정 창 | `state`가 `awaiting_review` 또는 `failed` | `choices`(결정 값 `like`·`use_lower`·`frame`·`retake` 중 허용된 것) |
       | 2 | 확정 창 | `confirmedKind`가 null이고 `choices`가 비어 있지 않음 | `choices`(확정 값 `animated`·`relief`·`frame`·`sculpture` 중 허용된 것), 못 고르는 것은 `unavailableChoices`의 이유 |
       | 3 | 진행 중(폴링 계속) | 상세 `stages`에 대기·실행 중 단계가 있다(목록은 `currentStage`가 null이 아님) | 없음 |
       | 4 | 끝 | 위에 해당 없음 | 없음(폴링 멈춤) |

     - 폴링은 진행 중일 때만 3→6→10초, 숨긴 탭에서 멈춘다(기술 컨텍스트).
     - 로그인이 만료되면(401) 다시 로그인 창으로 보낸다(#30).
     - 중복 제출은 계약이 이미 막는다(업로드 `Idempotency-Key`, 확정은 같은 값이면 200, 결정은 회차당 1회). 화면은 처리 중 버튼만 잠근다.
     - 파일 주소(`/v1/files/{token}`)는 계약에 [추론] 5분 만료로 적혀 있어, 실패하면 상세를 다시 읽는다.
     - 서버에 닿지 않으면 알리고 다시 시도하게 한다. 기기 저장으로 몰래 바꾸지 않는다(3-3).
   - **화면 배치(B가 #29·#38·#39에서 정함):** 로그인 창 위치, 확정·결정 알림과 창의 모양·위치. #19의 초안은 제안일 뿐이다.
6. **기동·준비 상태·종료.**

   | 서비스 | 준비됨의 기준 | 먼저 끝나야 하는 것 |
   |---|---|---|
   | db | 공식 스크립트 `healthcheck.sh --connect --innodb_initialized`(DB 접속 가능) | 없음 |
   | db-migrate | `node dist/scripts/migrate.js`(+ 개발 환경 모델 첫 활성)가 성공으로 끝남(스키마 준비 완료) | db healthy |
   | app-api | `/live` 응답 | db-migrate `service_completed_successfully` |
   | sweeper | 프로세스가 살아 있음 | db-migrate 완료 |
   | model-api | `/internal/ready`가 HTTP로 응답(자기 프로세스) | db-migrate 완료 |
   | worker-cpu | 상태 파일이 60초 안에 갱신됨 | db-migrate 완료 |
   | web | `/` 응답 | app-api healthy |
   | mailpit | 없음 | 없음 |

   - [확인] 워커는 시작할 때 `model_version`을 조회하고(`runner.py` 62행), 실행 중에도 20초마다 다시 조회한다(354행). 둘 다 오류를 잡는 범위 밖이라 DB 오류가 나면 프로세스가 끝나고, 재시작 정책이 다시 띄운다. 작업을 가져오는 중의 DB 오류만 기다렸다 다시 연결한다(361~364행). 그래서 스키마가 준비되기 전(db-migrate 완료 전)에는 띄우지 않는다.
   - [확인] `/internal/ready` 본문의 `groups.cpu`는 "cpu 워커의 상태 파일이 60초 안에 갱신됐다"(워커 생존)는 뜻이다. 모델 준비는 `models[].load.state`로 따로 본다. 그래서 `groups.cpu`를 model-api의 상태 검사로 쓰지 않고, 모델 준비는 #41·#42의 확인 항목으로 둔다.
   - [확인] `init: true`는 종료 신호를 전달하고 좀비 프로세스를 거둘 뿐이다. app-api·sweeper는 종료 신호 처리가 없어 즉시 끝난다. [추론] 커밋하지 않은 DB 작업은 연결이 끊기면 DB가 되돌린다. 워커는 종료 신호를 받으면 멈춤 표시를 하지만(`serving/workers/main.py` 15행), 진행 중 작업이 `docker compose stop`의 10초 안에 끝나지 않으면 강제 종료되고, 점유 60초가 지난 뒤 sweeper가 이어받는다. [미검증] #41에서 "작업 도중 worker를 멈추고 다시 켜면 그 작업이 이어받아져 끝난다"를 확인한다.

**기존 코드 수정 판정(#33·#34·#35).**

| 이슈 | 판정 | 근거 |
|---|---|---|
| #33 DB 초기화 | **고친다.** 마이그레이션 폴더를 설정 값(`MIGRATIONS_DIR`)으로 받고(1줄), 개발 환경 모델 첫 활성을 db-migrate에 더한다 | [확인] 빌드된 `dist/scripts/migrate.js`에서 `../../db/migrations`는 `api/db/migrations`가 되어 폴더가 없다. 새 DB에 활성 모델 버전이 없다 |
| #34 워커 준비 상태 | 코드는 고치지 않는다. 상태 검사 기준만 위 표대로 | [확인] 상태 파일이 60초 넘게 멈추면 이미 멈춤으로 본다(`STALE_AFTER_S = 60`) |
| #35 sweeper 종료 | 지금은 코드를 고치지 않는다. `init: true`는 신호 전달용으로만 쓴다. #35에서 종료 시간·종료 결과를 기록하고, 정리가 안 되는 문제가 드러나면 그때 종료 처리 코드를 더한다 | [확인] 한 번 다 돈 뒤 다음 차례를 잡아 겹치지 않는다(`setTimeout`). 빠른 종료와 작업·DB·파일의 정상 정리는 다르므로, 작업 중단 뒤 재시작·이어받기는 #41에서 따로 확인한다 |

## 4. 역할 배정

| 사람 | 환경 | 역할 | 맡는 폴더 | 하는 일 | 리뷰어 |
|---|---|---|---|---|---|
| 최호준(`zozu001`) | Windows(WSL, x86_64) | A 모델 서빙 + 묶기 | `serving/`, `compose.yaml` | serving 이미지(model-api·worker-cpu), 실제 모델(M1·M2·M5), compose로 묶기와 db·mailpit·sweeper 서비스 설정, `.env.example` | 신지현 |
| 신지현(`tlswlgus960-prog`, 팀장) | Windows(WSL, x86_64) | B 프론트엔드 + 입구·처음부터 띄워 보기 | `web/`(화면·빌드), 입구 nginx, `.gitattributes` | 3D 미술관 화면의 디자인과 인터페이스 전반(화면 흐름, 창, 문구, 상태·오류 표시, 반응형), web 이미지와 nginx, 개인정보 문구와 서비스 워커, 깨끗한 PC에서 처음부터 띄워 보기 | 이제민 |
| 이제민(`wpalswpa`) | 맥(arm64, 메모리 여유) | C 앱·데이터·연결 + 병합 | `api/`, `db/`, `contracts/`, `web/src/app/world/`의 서버 연결 층 | api 이미지와 주소·프록시 설정, 스키마 시험과 대응표, 3D 화면의 서버 연결 층(올리기·상태·전시, 3-3 표), 설계 PR 작성 | 최호준 |

- 배정은 2026-10-30 다시 정했다. 바꾸면 이 표와 `.github/CODEOWNERS`부터 고친다.
- **실제 모델과 PC.** 역할 A는 Windows에서 일한다. WSL2는 따로 정하지 않으면 PC 메모리의 절반만 쓴다(Microsoft WSL 설정 문서, `.wslconfig`의 `memory`). M1 추론 중 약 8.5GB가 들므로, 1일차 측정(I-04)에서 WSL 메모리 한도를 먼저 확인하고 모자라면 `.wslconfig`로 늘린다. 그래도 모자라면 Windows에서는 가짜 모델로 만들고, 실제 모델 한 바퀴와 7절 수치는 맥(이제민 PC)에서 둘이 함께 잰다.
- 협업 규칙은 팀 핸드북(`kids-gallery/team-handbook`)을 따른다: Issue 먼저, 작업 가지에서 커밋, PR은 작성자가 아닌 사람의 승인 1회, `main` 직접 push 금지(관리자 포함). 병합은 이제민이 하고, 이제민 자신의 PR은 다른 사람이 승인한 뒤 병합한다. 자기 PR을 자기 승인으로 합치지 않는다.
- PR을 올리기 전에 자기 폴더의 시험(`npm test`, `pytest`)을 로컬에서 돌리고 결과를 PR에 적는다.
- 모든 작업은 "설계서 수정 → 구현 → 결과가 달라지면 설계서 다시 맞춤" 순서다.

### 4-1. PR 검토(사람)

**리뷰봇은 꺼 둔다(2026-10-30 결정).** 하루 써 보니 잘 만든 PR을 문서 분량과 이슈 양식 수정 때문에 막고, AI 검토는 출력 한도 문제로 계속 실패했다. 무료 비공개 저장소라 어차피 병합을 강제할 수 없어서(브랜치 보호 403) 실제 관문은 사람 승인이다. 그래서 PR 양식과 사람 리뷰로 진행한다. 리뷰봇 파일(`.github/review-bot/`, `.github/workflows/review-bot.yml`)은 남겨 두었고, 다시 쓰려면 `gh workflow enable review-bot -R kids-gallery/uri-gallery`로 켠다.

**흐름.** 작성자가 PR 양식(부록 B)대로 PR을 올린다 → 4절 표의 리뷰어가 아래 확인 목록을 보고 승인(Approve)하거나 고칠 점을 남긴다(Request changes) → 이제민이 승인 1회를 확인하고 병합한다 → 본문의 `Closes #번호`로 이슈가 저절로 닫힌다.

**리뷰어 확인 목록.** 리뷰봇이 보던 규칙 가운데 쓸모 있던 것을 사람이 본다.

| 확인 | 내용 | 근거 |
|---|---|---|
| 이슈 연결 | 본문 "관련 이슈"에 `Closes #번호`(일부만 끝냈으면 `Refs #번호`) | 핸드북 규칙 1 |
| PR 양식 | 관련 이슈·설계서·변경 사항·확인한 것이 채워져 있다. "확인한 것"에 실제로 돌린 명령과 결과가 있다 | 부록 B |
| 가지·커밋 | 가지 `종류/이슈번호-설명`(예: `feat/23-serving-image`), 커밋 `종류: 설명 (#이슈번호)`. 종류는 feat·fix·docs·refactor·test·chore | 핸드북 규칙 3, 커밋 컨벤션 |
| 비밀 값·금지 파일 | `.env`, `secrets/`의 실제 값 파일, 키·비밀번호 값, 모델 가중치, 5MB 넘는 파일이 없다 | 8절, 3-2 |
| 설계서 먼저 | 코드·Dockerfile·compose를 바꿨으면 설계서도 바꿨거나 "설계서" 칸에 근거 절이 있다 | 4절 |
| 범위 | 10절에서 뺀 것(모니터링, GPU, 레지스트리, 배포 등)이 없다 | 10절 |
| 크기 | 문서(`.md`)와 잠금 파일을 뺀 바뀐 줄이 300줄 안팎. 600줄을 넘으면 나눌 수 있는지 먼저 본다 | 이슈 하나 = PR 하나 |
| Dockerfile 기본 | 기반 이미지 판 번호 고정(`latest` 금지), 의존성 먼저 소스 나중, 같은 폴더에 `.dockerignore` | 3-4 |

## 5. 5일 순서

날짜는 2026-10-30(금)부터 11-05(목)까지다(사용자 확인 2026-10-30). 1일차와 2일차 사이에 주말이 있으므로, 설계 PR은 금요일 저녁까지 올리고 월요일 오전에 리뷰·병합한다.

아침 10분은 그날 쓰는 교안 주제를 같이 다시 본다(가이드 3절).

| 날 | 함께 | 최호준(A 모델 서빙) | 신지현(B 3D 화면) | 이제민(C 앱·데이터·연결) | 그날 끝 확인 |
|---|---|---|---|---|---|
| 1일차 바탕(10-30 금) | 역할 확인, 셋 다 `docker run hello-world`와 저장소 clone·push 확인, 3D 화면을 개발 서버로 띄워 써 보기, 설계 PR(3-5) 쓰기 시작 | 리눅스 컨테이너 CPU로 M1·M2·M5 한 장당 시간과 메모리 재기(WSL 메모리 한도 먼저 확인) | `.gitattributes`, WSL에서 `npm run build:world` | MariaDB 컨테이너에 스키마 넣어 보기, 3D 화면 ↔ API 대응표 확정 | 설계 PR이 올라와 있다 |
| 2일차 따로 만들기(11-02 월) | 오전에 설계 PR 리뷰·병합 | serving 이미지(가짜 모델 먼저), model-api 주소 설정, CPU별 모델 묶음, Mailpit·환경 변수 | web 이미지와 nginx, 3D 화면 가입·로그인 창 | api 이미지, 주소·프록시 설정, 서버 연결 층, 사진 올리기 | 각자 이미지가 혼자 뜬다. 개발 서버에서 3D 화면이 API로 사진을 올린다 |
| 3일차 묶기(11-03 화) | 저녁에 셋이 같은 compose를 받아 띄우기 | `compose.yaml`에 7개 묶기(볼륨·기동 순서), DB 초기화, 가짜 모델 워커, sweeper | 아이 고르기·확정·결정 창 | 상태 묻기와 재시도, 전시 목록과 컷아웃 입체 | 가짜 모델로 세 PC 모두 가입 → 사진 → 확정 → 3D 전시 한 바퀴 |
| 4일차 재고 다듬기(11-04 수) | 저녁에 기능 동결, 예비 시연 영상 | 실제 모델 켜기, 맥(이제민 PC)에서 이제민과 함께 한 바퀴, 처리 시간·메모리 재기 | 개인정보 문구와 서비스 워커, 깨끗한 PC에서 처음부터 띄워 보고 README 실행 방법, `down` 뒤 `up`에도 작품이 남는지 | 맥 실측 함께, 병합과 발표를 막는 버그 고치기 | 맥에서 실제 모델로 한 바퀴, 7절 수치표 |
| 5일차 발표(11-05 목) | 오전 리허설 2회 | 모델 서빙·compose 설계, 한계 | 입구·화면 부분 | 문제, 앱·데이터·연결 부분, 시연 진행 | 발표 |

## 6. 발표 구성(10분)

| 순서 | 내용 | 맡는 사람 |
|---|---|---|
| 1 문제 | 아이 작품을 버리기 곤란한 부모. 모델 서빙은 탄탄했지만 한 서버에 손으로 맞춘 프로세스 8개였고 화면은 평면이었다 | 이제민 |
| 2 설계 | compose 구성도(서비스 7개, 바깥 포트 2개, 볼륨 4개), 3D 화면 ↔ API 연결, 뺀 것과 이유 | compose 구성 최호준, 3D 연결 이제민 |
| 3 구현 | 각자 만든 부분, 고친 코드, 잰 수치 | 각자 |
| 4 시연 | `docker compose up -d` → 3D 미술관에서 가입 → 사진 → 확정 → 입체 전시 | 이제민 진행, 신지현·최호준 화면 |
| 5 한계와 다음 | GPU, 메모리, 배포(Vercel 같은 정적 호스팅 + 서버 따로) | 최호준 |

## 7. 각자 남길 작업 기록

| 수치 | 재는 방법 |
|---|---|
| 서비스별 이미지 크기 | `docker image ls` |
| `docker compose up -d`부터 전부 준비됨까지 | `docker compose ps`로 상태 확인이 다 통과할 때까지 |
| 실제 모델별 한 장 처리 시간과 메모리(M1·M2·M5, 맥) | 작업 기록의 단계 시간, `docker stats` |

각자 남길 것: 맡은 PR 목록, 고른 것과 버린 것 하나씩(이유 포함), 막힌 것과 푼 방법.

## 8. 끝나는 조건

- 설계 PR이 구현 PR보다 먼저 병합돼 있다.
- 깨끗한 PC에서 `docker compose up -d` 뒤 가짜 모델로 3D 미술관 한 바퀴(가입 → 사진 → 확정 → 전시)가 된다.
- 맥에서 실제 모델(M1·M2·M5)로 한 바퀴가 된다.
- `docker compose down` 뒤 다시 `up` 해도 가족 작품이 남는다.
- 저장소에 `.env`·비밀 값·모델 가중치가 0건이다.
- 발표를 마쳤고 7절 수치와 각자 작업 기록이 있다.

## 9. 나중에 할 것(이번 5일 밖)

- **배포**(사용자 결정 2026-10-29: 나중에 따로 연결). 3D 화면(`dist-world`)은 Vercel 같은 정적 호스팅에 올릴 수 있다. app-api·모델 서버·DB는 정적 호스팅에 올릴 수 없어서 컨테이너를 돌리는 서버가 따로 필요하다. 화면과 서버의 출처가 달라지면 쿠키·CORS 설정이 생긴다.
- 방 배치·캐릭터 같은 기기 저장 자료를 서버로 옮기기, 이웃 미술관을 3D로 보기.

## 10. 하지 않을 것

- 지난 판 평면 화면(`/app/...`의 3D 미술관 밖 화면)을 살리거나 고치기.
- 서비스 기능 바꾸기(모델 서빙 규칙·DB·API 계약). 3D 화면 연결에 꼭 필요한 것만 설계서를 먼저 고친 뒤 바꾼다.
- 3D 화면에 새 기능 더하기(연결 외).
- CI 옮기기와 이미지 자동 빌드, 레지스트리에 올리기, 태그별 되돌리기, 모니터링(Prometheus·Grafana), 장애 리허설과 운영 절차서, 백업 스크립트, 보안 점검표, GPU 이미지.
- M3·M6·M7을 실제로 컨테이너에 넣기, 카카오 로그인.
- Dockerfile·compose를 한 사람이 대신 다 만들어 주기(리뷰와 짝 작업은 좋다).
- Kubernetes 같은 묶음 운영 도구, 유료 서비스, 승인 없는 공개 배포.
- 시간이 남아도 위 항목을 다시 넣지 않는다.

## 부록 A. 이슈 양식

`.github/ISSUE_TEMPLATE/`에 두 가지를 둔다(2026-10-30 추가). GitHub는 기본 가지(`main`)에 있는 양식만 보여 준다.

| 양식 | 쓰는 때 | 칸 | 칸을 둔 이유 |
|---|---|---|---|
| 작업 | 5절 표의 일 하나 | 한 줄 설명 · 이루려는 것 · 근거 · 대상 경로 · 해야 할 일 · 끝나는 조건 · 순서와 담당(날짜·담당·선행·리뷰어) | 한 줄 설명은 처음 보는 팀원이 제목만으로 모르는 일을 바로 알게 한다. 근거 칸은 그 일이 계획 범위 안인지(10절 "하지 않을 것"을 막음) 확인하게 한다. 대상 경로는 `CODEOWNERS`의 폴더 주인과 맞춰 리뷰어를 정하게 한다. "설계서 먼저" 체크는 절대 규정, 끝나는 조건은 8절처럼 남이 확인할 수 있는 결과, 선행은 "설계 PR이 먼저"와 compose 충돌 순서, 리뷰어는 4절 |
| 문제 | 작업 중 안 되거나 막힘 | 무엇이 안 되나 · 다시 만드는 방법 · 기대와 실제 · 근거 · 막는 범위 · 끝나는 조건 | 세 사람 환경(맥 arm64, Windows WSL x86_64)이 달라 환경과 명령 없이는 재현할 수 없다. 막는 범위는 그날 끝 확인(5절)에 걸리는지 보고 먼저 고칠 것을 정하게 한다 |

5절 일정을 이 양식대로 나눈 이슈 35개와 순서는 `docs/공통/이슈설계_컨테이너협업.md`에 있고, `docs/_claude/이슈올리기.py`가 그 목록을 양식 칸 순서대로 본문으로 만든다(양식 칸과 다르면 점검에서 멈춘다). 담당자 아이디와 리뷰어는 4절 표에서 읽으므로, 배정을 바꾸면 4절 표만 고친다. 이슈는 날짜별 마일스톤(`준비`, `1일차 10-30(금)` … `5일차 11-05(목)`)에 묶어, 마일스톤 화면에서 그날 이슈와 진행률만 보게 한다. 작업 중 올린 "문제" 이슈는 올린 날의 마일스톤에 넣는다. 제목은 작업 `[N일차·MM-DD 요일 · 담당] 대상과 할 일`(셋이 함께 맡으면 담당 자리에 `공통`), 문제 `[문제 · 올린 사람] 한 문장`이다. 목록과 알림에서 누가 볼 이슈인지 바로 보이게 하려는 것이다. 작업 이슈 제목의 담당은 스크립트가 이슈 목록의 "담당" 칸으로 만들므로, 배정을 바꾸고 다시 실행하면 제목도 함께 바뀐다. 가지·커밋·PR에는 이슈 번호를 쓴다(4-1). 이슈와 PR은 번호를 같이 쓰므로 둘의 번호는 맞지 않는다.

## 부록 B. PR 양식

`.github/pull_request_template.md`에 들어 있다. 핸드북 양식에 "설계서"와 "확인한 것(명령과 결과)"을 더했다. 리뷰어는 4-1 확인 목록으로 이 칸들을 본다.

```text
## 관련 이슈
Closes #번호

## 설계서
설계서: 계획서 3-2 / SD_04 ○절 (문서만 바꾸면 "해당 없음")

## 변경 사항
- (파일과 한 줄 설명)

## 확인한 것
- 실행한 명령과 결과(종료 코드, 수치). 이미지를 바꿨으면 크기와 빌드 시간
- 화면이 바뀌었으면 캡처

## 남은 것
- (확인하지 못한 것과 이유)

## 리뷰 요청 사항
- (리뷰어가 특히 봐 줄 곳)
```
