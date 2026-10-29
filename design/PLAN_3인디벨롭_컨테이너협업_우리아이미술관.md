# 우리 아이 미술관 마스터플랜(모델 서빙 서비스를 Docker Compose로 완성하고 발표하기, 5일)

작성 2026-10-28, 고침 2026-10-29. 독자는 함께 작업할 팀원 3명이다. 대상은 지난 모델 서빙 팀 프로젝트(우리 아이 미술관 팀 판, `main` 브랜치 `7c6a8ab`, 2026-09-30)다. 서비스 기능과 모듈 경계(`SD_04_아키텍처설계서_우리아이미술관.md`)는 그대로 두고, 실행·배포·운영 방식만 컨테이너로 다시 짓는다. 날마다 교안의 무엇을 함께 복습하고 무엇으로 확인하는지는 `docs/공통/컨테이너배포_팀가이드.md`에 있다.

## 1. 이루려는 것(5일)

- **핵심 하나.** `docker compose up -d` 한 명령으로 서비스가 뜨고, 가입 → 사진 올리기 → 배경 분리 → 결과 확정 → 전시까지 한 바퀴가 된다. 같은 방법으로 배포 서버에도 띄운다.
- **발표.** 그 한 바퀴를 실제 화면으로 시연하고, 서비스를 컨테이너로 어떻게 나눴는지 설명한다(6절).
- **작업 기록.** 각자 맡은 이미지를 자기 PR로 만들고, 고른 것과 버린 것을 설명할 수 있게 남긴다(7절).
- 기간이 짧아서 핵심 흐름에 필요 없는 일은 하지 않는다(10절). 시간이 남아도 범위를 늘리지 않고 발표 준비와 한 바퀴 다시 돌리기에 쓴다.
- 팀원 3명이 직접 만든다. 저장소에는 미리 만든 Dockerfile·compose 파일이 없다.

## 2. 지금 상태(2026-10-28 확인)

| 영역 | 사실 | 확인한 곳 |
|---|---|---|
| Docker | 쓰지 않는다. Dockerfile·compose·`.dockerignore`는 저장소에 0개다. 팀 구현 계획이 "Docker 컨테이너를 사용하지 않고 전개"로 정했다(`Intent-Plan.md` 본문의 "Docker: 컨테이너 패키징"은 쓰지 않기로 했다) | `.specify/…/plan.md` 40·77·196~197행, `Intent-Plan.md` 29행 |
| 실행 | 서버에 런타임을 직접 깔고 pm2로 띄운다. 기본 구성(`ops/server/ecosystem.config.cjs`)은 6개(app-api·sweeper·model-api·worker-cpu·worker-gpu·torchserve)다. 팀 서버에서는 `ops/p1/ecosystem.config.cjs`가 이 구성을 불러 저장소 루트 `.env`를 각 프로세스에 넣고(앱과 서빙은 `.env`를 스스로 읽지 않는다), 입구 nginx(p1-nginx)와 Mailpit을 더해 8개를 띄운다 | `ops/p1/ecosystem.config.cjs` 2·7·23·26·30·36행, `ops/server/DEPLOY.md` 6·7절 |
| 서버 | 팀 서버 1대(Studio-B, 맥)에 배포했다. 공개 주소의 TLS는 같은 서버의 공유 nginx가 풀어 9501(평문)로 넘긴다. 모델 6개 중 M2·M5·M7은 애플 GPU(MPS), M6(Ollama)은 Metal에서 돈다(M2는 worker-cpu 안에서 쓴다) | SD_04 배치 칸·4-3, `models/manifest.yaml`, `serving/workers/runner.py` 33~41행 |
| 개발 환경 | Ubuntu 24.04(Windows는 WSL, 맥은 가상머신)에 Docker Engine과 Compose를 쓴다. 팀원마다 CPU 종류가 다를 수 있다(Windows PC는 보통 x86_64, 맥 가상머신은 arm64). 맥 가상머신은 메모리 8GB다 | 팀원 환경 확인(0단계) |
| 시험 | CI(`.gitlab-ci.yml`)가 검사 4종(api·contracts·web·serving)을 돈다. 검사는 `node:22`·`python:3.11` 이미지 위에서 돌지만 우리 이미지는 만들지 않는다. 화면 흐름 시험은 `web/e2e`(Playwright)에 있다 | `.gitlab-ci.yml`, `web/playwright.config.ts` |
| 원격 저장소 | 팀 저장소 `github.com/kids-gallery/uri-gallery`(비공개)의 `main`. `team/container-start` 가지를 이력 그대로 올렸다. 예전 원격(`wpalswpa/project2610`)에는 올리지 않는다 | 사용자 결정 2026-10-28·10-29 |

### 2-1. 팀 작업 전에 바탕을 정리한 것(2026-10-28)

Docker 파일은 만들지 않았다. 팀원 환경(리눅스, x86_64·arm64)에서 같은 서비스를 깔고 시험할 수 있게, 리눅스에서 막히던 곳만 고쳤다. 확인은 Debian 기반 `python:3.11` 컨테이너에서 root가 아닌 사용자로 했다. 그 컨테이너 설정은 저장소에 남기지 않았다(팀이 직접 만든다).

| 막히던 것 | 고친 것 | 확인 |
|---|---|---|
| 모델 묶음 잠금(`serving/requirements-models.lock`)이 맥 기준으로 풀려 있어, x86_64 리눅스에서 PyTorch가 요구하는 CUDA 패키지(`nvidia-*`)가 잠금에 없어 설치가 멈춘다 | x86_64 리눅스용 잠금 `serving/requirements-models-linux-x86_64.lock`. 맥 잠금과 버전이 모두 같고 PyTorch·torchvision만 CPU 전용(`+cpu`)이다. CUDA 패키지 0개 | 고치기 전: arm64 리눅스는 설치 풀기 통과, x86_64는 해시 없음으로 실패. 고친 뒤 x86_64(흉내 실행): 설치 종료 0, CUDA 패키지 0개, `torch 2.4.1+cpu`, 가상환경 1.5GB, 서빙 시험 145개 통과·5개 건너뜀(arm64와 같다) |
| 서빙 시험이 MariaDB 실행 파일을 맥 경로(`/opt/homebrew/bin`) 한 곳에서만 찾는다. CI는 `/usr/sbin` 한 폴더만 넘겨 Debian에서는 깨진다 | 시험 설정이 PATH·`/usr/sbin`·`/usr/bin`에서 찾는다(`MARIADB_BIN`을 주면 그 폴더). CI의 넘김을 뺐다 | arm64 리눅스: 서빙 시험 140개 통과·9개 건너뜀(가짜 모델용 기본 잠금만), 145개 통과·5개 건너뜀(모델 묶음까지). `caption` 시험 26개 통과 |
| 기본 잠금만 깐 환경에서 numpy를 쓰는 시험 때문에 시험이 모이지도 않는다(맥 개발 환경은 모델 묶음까지 깔려 있어 가려졌다) | numpy·scipy가 없으면 그 시험만 건너뛴다 | 같은 실행 |
| 서빙 안내 문서가 맥 설치만 적었다 | `serving/README.md`에 플랫폼별 잠금 표와 리눅스 시험 방법 | 없음 |

손대지 않은 것: TorchServe(M3) 환경 목록 `serving/conda-m3.lock`은 맥(osx-arm64) 전용 그대로다(이번 5일에는 M3를 가짜로 둔다, 3-1). 실행 환경 지문 계산(`serving/ops/models.py` 173~175행)은 맥 잠금을 재료로 쓰는 그대로다(3-6 데이터·배포 질문).

## 3. 만들 것(5일 범위)

### 3-1. 완성 기준

한 바퀴는 이메일 가입(확인 메일은 Mailpit 화면에서 연다) → 가족·아이 만들기 → 사진 올리기 → 분리(M1) → 판정 제안(M2) → 보호자 확정 → 2.5D 부조(M5) 또는 액자 → 전시다.

- 실제 모델은 M1·M2·M5 세 개만 쓰고, 메모리가 넉넉한 맥에서 돌린다. 다른 PC와 메모리가 작은 서버는 가짜 모델(`UAM_FAKE_MODELS=1`)로 같은 흐름을 돈다.
- 움직이는 그림(M3)과 3D 조각(M7)은 가짜 어댑터로 둔다(`UAM_FAKE_MODELS=M3,M7`). 권유가 "움직이는 그림"이어도 흐름이 끊기지 않는다. M3는 Java·conda 환경이 무겁고 렌더 경로가 맥 전용이라(부록 A) 5일 안에 옮기지 않는다.
- 설명 생성(M6)과 카카오 로그인은 끈다. 메일은 끄지 않는다. 메일을 끄면 이메일 가입도 꺼지기 때문이다(`api/src/modules/auth/routes.ts` 66행).
- 모든 모델은 CPU로 돈다(`GPU_ENABLED=false`, M5는 CPU 작업자가 맡는다).

### 3-2. compose 구성(설계 PR에서 확정)

| 서비스 | 이미지 | 바깥 포트 | 담당 |
|---|---|---|---|
| web(입구) | 빌드 단계 `node:22` → 실행 단계 nginx(팀 판 빌드 결과와 입구 설정) | 9501 | 팀원 A |
| app-api | api 이미지(`node:22`) | 없음 | 팀원 B |
| sweeper | app-api와 같은 이미지, 실행 명령만 다르다 | 없음 | 팀원 B |
| db | MariaDB 공식 이미지(지금 판과 같은 12.0 계열) | 없음 | 팀원 B |
| mailpit | Mailpit 공식 이미지 | 8025(메일 화면) | 팀원 B |
| model-api | serving 이미지(`python:3.11`) | 없음 | 이제민 |
| worker-cpu | model-api와 같은 이미지 + 모델 묶음, 실행 명령만 다르다 | 없음 | 이제민 |

- 바깥에 여는 포트는 9501과 8025 둘이다. 나머지는 compose 안쪽 네트워크에서 서비스 이름으로 부른다.
- 볼륨 4개: DB 자료, 작품 파일(app-api·sweeper·model-api·worker-cpu가 함께 붙인다), 작업자 상태 폴더(`UAM_RUN_DIR`, model-api·worker-cpu), 모델 가중치(읽기 전용, 실제 모델을 쓸 때만).
- 기동 순서: db가 준비된 뒤 app-api·model-api·worker-cpu가 뜬다(`depends_on`의 `service_healthy`). 모든 서비스는 `restart: unless-stopped`.
- 비밀 값은 `.env`(저장소에 넣지 않는다)로만 넘긴다. `.env.example`에는 칸 이름만 둔다.
- 띄우지 않는 것: worker-gpu, torchserve, 설명 생성 서버.

### 3-3. 고칠 코드(작게, 설계서 먼저)

| 고칠 것 | 왜 | 담당 |
|---|---|---|
| app-api 바인딩 주소를 설정 값으로(기본값은 지금처럼 127.0.0.1) | 127.0.0.1이 코드에 고정돼 다른 컨테이너가 부를 수 없다(`api/src/server.ts` 14행) | 팀원 B |
| app-api 프록시 신뢰 범위를 설정 값으로 | 입구가 다른 컨테이너가 되면 요청 한도가 모든 사용자에게 한 IP로 걸린다(`api/src/app.ts` 24행) | 팀원 B |
| model-api 바인딩 주소를 설정 값으로 | app-api와 같은 이유(`serving/model_api/main.py` 8행) | 이제민 |
| 모델 묶음 잠금을 CPU 종류에 따라 고르는 빌드 인자 | 맥(arm64)과 Windows(x86_64)가 같은 Dockerfile을 쓴다 | 이제민 |
| `.gitattributes`(줄바꿈 LF) | Windows에서 셸 스크립트가 CRLF가 되면 컨테이너에서 깨진다 | 팀원 A |

### 3-4. 설계 PR에서 답할 질문

설계 PR(1일차 끝~2일차 오전)이 아래 여섯 가지에 답하고 3-2를 확정한다.
1. **서비스 나누기.** 3-2의 7개로 충분한가. 같은 빌드를 쓰는 둘(app-api·sweeper, model-api·worker-cpu)은 이미지 하나를 나눠 쓰는가.
2. **이미지.** 기반 이미지와 버전은 무엇인가. 잠금 파일을 먼저 복사해 설치하고 소스는 나중에 넣어, 소스만 바꿨을 때 설치를 다시 하지 않는가. `.dockerignore`에 넣을 것(`node_modules`, `.env`, 모델 가중치, 시험 결과물)은 무엇인가.
3. **CPU 종류.** x86_64 리눅스는 `serving/requirements-models-linux-x86_64.lock`, 맥과 arm64 리눅스는 `serving/requirements-models.lock`을 쓴다. 빌드 인자 하나로 고르는가.
4. **데이터.** 볼륨 4개를 어떻게 붙이는가. 모델 가중치는 저장소에 없다(`models/README.md`). 어디서 받아 어디에 두는가.
5. **주소와 설정.** 고정 주소를 설정 값으로 바꾼 뒤 서로 서비스 이름으로 부른다. `.env`로 넘길 값(`DB_PASSWORD`, `SESSION_SECRET`, `AUTH_HMAC_SECRET` 등)의 목록은 무엇인가. 지금은 pm2 설정이 `.env`를 읽어 넣는다(`ops/p1/ecosystem.config.cjs`). compose에서는 `env_file`이 넣는다.
6. **기동.** 서비스마다 "준비됨"을 무엇으로 판단하는가(app-api `/live`·`/ready`, model-api `/internal/ready`, db는 공식 이미지의 확인 스크립트). DB 스키마는 언제 어떤 명령으로 넣는가(지금은 `api`의 `npm run db:migrate`).

## 4. 역할 배정

| 사람 | 환경 | 역할 | 맡는 폴더 | 하는 일 | 리뷰어 |
|---|---|---|---|---|---|
| 이제민(`wpalswpa`) | 맥(arm64, 메모리 여유) | 모델 서빙 + 묶기 + 배포 | `serving/`, 최상위 `compose.yaml` | serving 이미지(model-api·worker-cpu 공유), 실제 모델 3개, compose로 묶기, 배포 서버에 띄우기 | 팀원 A |
| 팀원 A(`zozu001`) | Windows(WSL, x86_64) | 입구·화면 | `web/`, 입구 nginx 설정, `.gitattributes` | web 이미지(빌드 단계와 실행 단계 나누기), nginx가 서비스 이름으로 api를 부르게, 깨끗한 Windows PC에서 처음부터 띄워 보고 README의 실행 방법 쓰기 | 팀원 B |
| 팀원 B(`tlswlgus960-prog`, 팀장) | Windows(WSL, x86_64) | 앱·데이터 + 병합 | `api/`, `db/` | api 이미지(sweeper 공유), db·mailpit 서비스, 볼륨, `.env.example`, 스키마 넣기 | 이제민 |

- 배정은 2026-10-29 정했다. 1일차 아침에 각자 확인하고, 바꾸면 이 표부터 고친다.
- 협업 규칙은 팀 핸드북(`kids-gallery/team-handbook`)을 따른다: Issue 먼저, 작업 가지에서 커밋, PR은 작성자가 아닌 사람의 승인 1회, `main` 직접 push 금지(관리자 포함). 병합은 팀장이 하고, 팀장 자신의 PR은 다른 사람이 승인한 뒤 병합한다. 자기 PR을 자기 승인으로 합치지 않는다.
- PR을 올리기 전에 자기 폴더의 시험(`npm test`, `pytest`)을 로컬에서 돌리고 결과를 PR에 적는다. 지금 CI 파일(`.gitlab-ci.yml`)은 GitHub에서 돌지 않고, 이번에는 옮기지 않는다.
- 모든 작업은 "설계서 수정 → 구현 → 결과가 달라지면 설계서 다시 맞춤" 순서다.

## 5. 5일 순서

아침 10분은 그날 쓰는 교안 주제를 같이 다시 본다(가이드 3절).

| 날 | 함께 | 이제민 | 팀원 A | 팀원 B | 그날 끝 확인 |
|---|---|---|---|---|---|
| 1일차 바탕 | 역할 확인, 셋 다 `docker run hello-world`와 저장소 clone·push 확인, 설계 PR(3-4) 쓰기 시작 | 리눅스 컨테이너 CPU로 M1·M2·M5 한 장당 시간과 메모리 재기 | `.gitattributes`, Windows에서 web 빌드 | MariaDB 컨테이너에 스키마 넣어 보기 | 설계 PR이 올라와 있다 |
| 2일차 이미지 | 오전에 설계 PR 리뷰·병합 | serving 이미지(가짜 모델), model-api 주소 설정 | web 이미지 | api 이미지, 주소·프록시 설정 | 각자 이미지가 빌드되고 혼자 뜬다 |
| 3일차 묶기 | 저녁에 셋이 같은 compose를 받아 띄우기 | `compose.yaml`에 7개 묶기 | 입구가 api를 서비스 이름으로 부르기 | db·mailpit·볼륨·기동 순서 | 가짜 모델로 `docker compose up -d` 뒤 세 PC 모두 한 바퀴 |
| 4일차 실제 모델·배포 | 저녁에 기능 동결, 예비 시연 영상 | 실제 모델 3개(가중치 볼륨), 배포 서버에 띄우기 | 깨끗한 PC에서 처음부터 띄워 보고 README 실행 방법 | 배포 서버 `.env`, `down` 뒤 `up`에도 작품이 남는지 | 맥에서 실제 모델로 한 바퀴, 배포 서버에서 한 바퀴 |
| 5일차 발표 | 오전 리허설 2회 | 문제·설계 발표, 시연 진행 | 입구·화면 부분 | 앱·데이터 부분, 한계 | 발표 |

## 6. 발표 구성(10분)

| 순서 | 내용 | 맡는 사람 |
|---|---|---|
| 1 문제 | 지금 서비스는 한 서버에 손으로 맞춘 프로세스 8개다(맥 전용 경로·잠금, 127.0.0.1 고정) | 이제민 |
| 2 설계 | compose 구성도(서비스 7개, 바깥 포트 2개, 볼륨 4개), 뺀 것과 이유(M3 가짜, GPU 대신 CPU) | 이제민 |
| 3 구현 | 각자 만든 이미지, 고친 코드, 잰 수치 | 각자 |
| 4 시연 | `docker compose up -d` → 가입 → 사진 올리기 → 결과 → 전시 | 이제민 진행, A·B 화면 |
| 5 한계와 다음 | GPU, M3, 메모리 | 팀원 B |

시연이 실패할 때를 대비해 4일차 저녁에 예비 영상을 만들어 둔다.

## 7. 각자 남길 작업 기록

재서 남길 수치는 세 가지다.

| 수치 | 재는 방법 |
|---|---|
| 서비스별 이미지 크기 | `docker image ls` |
| `docker compose up -d`부터 전부 준비됨까지 | `docker compose ps`로 상태 확인이 다 통과할 때까지 |
| 실제 모델별 한 장 처리 시간과 메모리(M1·M2·M5, 맥) | 작업 기록의 단계 시간, `docker stats` |

각자 남길 것: 맡은 PR 목록, 고른 것과 버린 것 하나씩(이유 포함), 막힌 것과 푼 방법. 발표의 "3 구현"과 같은 내용이다.

## 8. 끝나는 조건

- 설계 PR이 구현 PR보다 먼저 병합돼 있다.
- 깨끗한 PC에서 `docker compose up -d` 뒤 가짜 모델로 한 바퀴가 된다.
- 맥에서 실제 모델 3개로 한 바퀴가 된다.
- 배포 서버에서 한 바퀴가 된다.
- `docker compose down` 뒤 다시 `up` 해도 가족 작품이 남는다.
- 저장소에 `.env`·비밀 값·모델 가중치가 0건이다.
- 발표를 마쳤고 7절 수치와 각자 작업 기록이 있다.

## 9. 1일차 아침에 정할 것

| 질문 | 고를 것 | 영향 |
|---|---|---|
| 팀 저장소 | 정함(2026-10-29): `kids-gallery/uri-gallery` 비공개. 1일차에는 셋 다 clone·push가 되는지만 확인한다 | 1일차 전체 |
| 배포 서버 | 팀 서버(맥)의 Docker, 팀원 PC의 리눅스(WSL·가상머신), 클라우드 무료 범위 중 하나. M1 추론 중 메모리 8.5GB에 다른 서비스를 더하면 12GB 안팎이 필요하다(추정). 그보다 작으면 가짜 모델로 띄운다. 바깥 공개는 승인 뒤 | 4일차 |

## 10. 하지 않을 것

- 핵심 흐름에 필요 없는 일: CI 옮기기와 이미지 자동 빌드, 레지스트리에 올리기, 태그별 되돌리기, 모니터링(Prometheus·Grafana), 장애 리허설과 운영 절차서, 백업 스크립트, 보안 점검표, GPU 이미지, 3D 단독 판, 배포 판 표시.
- M3·M6·M7을 실제로 컨테이너에 넣기, 카카오 로그인.
- 서비스 기능 바꾸기, SD_04에 없는 모듈 새로 만들기.
- Dockerfile·compose를 한 사람이 대신 다 만들어 주기(리뷰와 짝 작업은 좋다).
- Kubernetes 같은 묶음 운영 도구, 유료 서비스, 승인 없는 공개 배포.
- 시간이 남아도 위 항목을 다시 넣지 않는다.

## 부록 A. 지금 구성 분석표(1일차에 채운다)

"지금"은 2026-10-28에 저장소 파일에서 확인한 값이다(`main`과 이 브랜치의 서버 설정·환경 값 예시·모델 목록·CI 파일은 같다). "확인할 것"은 팀이 실제로 띄우거나 재서 답한다.

| 구성 | 하는 일 | 지금 실행 방식 | 포트(지금) | 쓰는 설정 값(`.env`) | 데이터·파일 | 확인할 것 |
|---|---|---|---|---|---|---|
| 입구 nginx | 화면 파일, 경로별로 넘기기, 실제 접속 IP 넘기기 | pm2가 띄우는 Homebrew nginx(p1-nginx), `ops/p1/nginx.conf`. `ops/server/nginx.conf`는 9501에서 TLS를 직접 여는 단독 서버용 견본이다 | 9501(평문, 공유 nginx 뒤) | 없음 | 웹 빌드 결과(`.data/p1-web`) | `/v1/models/`는 9541, 나머지 `/v1/`·`/live`·`/ready`·`/openapi.json`은 9521로 넘긴다. 공유 nginx가 보낸 실제 접속 IP를 `set_real_ip_from`·`real_ip_header`로 받아 앱에 넘긴다(요청 한도). `/version.json`으로 배포한 판을 확인한다. 작품 파일을 nginx가 직접 내려주는 길(`/_files/`)은 p1 설정에 없다. 컨테이너 사이에서 실제 접속 IP를 어떻게 넘기는가 |
| 웹 | 화면 | Node 22로 빌드한 정적 파일(`npm run build`) | 없음(nginx가 내준다) | 빌드 때 `VITE_*` | 없음 | 빌드 이미지와 실행 이미지를 나누면 크기가 얼마인가 |
| app-api | 앱 API(가입·가족·작품·결과) | Node 22, `api/dist/src/server.js`, pm2 | 9521(127.0.0.1, 코드에 고정 `api/src/server.ts` 14행) | `DB_*`, `SESSION_SECRET`, `AUTH_HMAC_SECRET`, `SECURE_COOKIES`, `STORAGE_ROOT`, `APP_BASE_URL`, `FILES_ACCEL`, `MAIL_*`, `MODEL_API_INTERNAL_URL`, `MODEL_MANIFEST`, `MODEL_CHECK_ENABLED`, `GPU_ENABLED`, `LLM_SERVER_URL`, `CAPTION_ENABLED`, `KAKAO_*`, `API_GUIDE_TEST_KEY` | 파일 저장소(`family/`·`tmp/`·`ext/`, 팀 서버는 `.data/store`) | `DB_SOCKET`(유닉스 소켓) 대신 무엇으로 DB에 닿는가. 바인딩 주소와 프록시 신뢰(`trust proxy 'loopback'`, `api/src/app.ts` 24행)를 어떻게 바꾸는가. 작품 파일은 지금 app-api가 직접 보낸다(`FILES_ACCEL` 예시 기본값 0). 상태 확인 `/live`·`/ready`가 무엇을 보는가 |
| sweeper | 오래된 임시 파일·작업 정리 | 같은 빌드의 `dist/src/sweeper/main.js` | 없음 | app-api와 같음 | 파일 저장소 | app-api와 이미지를 나눠 쓸 수 있는가 |
| model-api | 모델 기능 API, 작업자 적재 상태 모으기 | Python 3.11 가상환경(`serving/.venv`), `python -m model_api.main` | 9541(127.0.0.1, 코드에 고정 `serving/model_api/main.py` 8행) | `DB_*`, `STORAGE_ROOT`, `MODEL_MANIFEST`, `UAM_RUN_DIR`, `GPU_ENABLED`, `UAM_FAKE_MODELS`, 상태 확인용 `TORCHSERVE_URL`·`LLM_SERVER_URL` | 모델 매니페스트, 파일 저장소, 작업자 상태 폴더(`UAM_RUN_DIR`, 기본 `serving/.run`, 작업자가 쓰고 model-api가 읽는다) | 가짜 모델(`UAM_FAKE_MODELS`)로 먼저 띄울 수 있는가. 작업자와 다른 컨테이너로 나누면 상태 폴더를 어떻게 함께 붙이는가 |
| worker-cpu | 단계 작업(M1 배경 분리, M2 분류, M3 관절 찾기 요청과 움직임 렌더, M4 규칙·액자). GPU를 끄면 M5 깊이도 맡는다 | 같은 가상환경, `workers.main --group cpu_vision`, 1개. M3 렌더는 `serving/.venv-m3`의 파이썬으로 하위 프로세스를 띄운다 | 없음 | 같음, M3는 `TORCHSERVE_URL`·`M3_AD_*`·`FFMPEG` | 모델 가중치(M1 444MB, M2 605MB), 파일 저장소, 상태 폴더 | 작업자와 모델의 대응은 `serving/workers/runner.py` 33~41행. 메모리(최대 RSS)는 M1 8.5GB, M2 1.0GB(SD_04 4-2 자원 배치). 서버 메모리와 컨테이너 한도를 얼마로 두는가. M2는 지금 이 작업자 안에서 애플 GPU(MPS)를 쓴다. M3 렌더에 넘기는 맥 전용 `DYLD_FALLBACK_LIBRARY_PATH`(`serving/adapters/m3_render.py` 6~7행)를 리눅스에서 어떻게 바꾸는가 |
| worker-gpu | 단계 작업(M5 깊이, M7 입체) | `workers.main --group gpu`, 1개 | 없음 | 같음 | 모델 가중치(M5 99MB, M7 1,677MB), 상태 폴더 | 메모리는 M5 1.3GB. 지금은 애플 GPU(MPS)에서 돈다. GPU 없는 리눅스 서버에서는 이 작업자를 띄우지 않고 M5를 CPU 작업자로 돌릴 수 있는가(`GPU_ENABLED`), 걸리는 시간은 얼마인가 |
| torchserve | M3 검출·자세 모델 2종 | 별도 conda 환경(`serving/.venv-m3`, Java 포함), 설정 `ops/torchserve/config.properties` | 9561~9563(127.0.0.1) | 없음(TorchServe를 부르는 쪽은 worker-cpu의 M3 어댑터다) | 모델 묶음 2개(`*.mar`, `MODEL_ROOT/m3/model-store`, 저장소에 없음, 702MB) | 메모리 약 2.0GB. 환경 목록(`serving/conda-m3.lock`)이 맥(osx-arm64) 전용이라 리눅스로 가려면 다시 잠가야 한다. 이미지 크기와 빌드 시간. 컨테이너에 넣을지(이번 5일에는 넣지 않는다, 3-1) |
| 설명 생성 서버(P0.5) | 작품 설명 문장(M6) | 지금 꺼져 있다(pm2 설정에 주석) | 없음 | `LLM_SERVER_URL`, `OLLAMA_URL`, `OLLAMA_CHAT_MODEL` | M6 가중치 2,497MB(Ollama) | 켤 때 Ollama(지금 호스트 127.0.0.1:11434)를 컨테이너에서 어떻게 부르는가 |
| DB | SD_03 자료 | 팀 서버의 MariaDB 12.0.2 | 유닉스 소켓(`DB_SOCKET`) 또는 TCP(`DB_HOST`·`DB_PORT`, 예시 파일에는 비어 있다) | `DB_*` | 스키마 이전 파일 1개(`db/migrations/0001_sd03_baseline.sql`) | 첫 기동 때 누가 스키마를 만드는가. 자료 볼륨과 백업·복원 명령 |
| 메일 | 이메일 계정 흐름(가입 확인·재설정)과 그 시험 | Mailpit 단일 실행 파일(pm2). 팀 서버는 `MAIL_ENABLED=false`로 메일을 보내지 않는다(R-23 결정 갱신 2). 화면 흐름 시험은 자기 Mailpit을 따로 띄운다 | 1025(SMTP)·8025(화면), 127.0.0.1 | `MAIL_SMTP_URL`, `MAIL_FROM`, `MAIL_ENABLED` | 받은 메일 기록(`.data/mailpit.db`) | Mailpit을 개발·시험용 묶음에만 넣는가. 서버 묶음에서 `MAIL_ENABLED`를 무엇으로 두는가 |
| 모델 가중치 | M1~M3·M5~M7 | `MODEL_ROOT`(기본 저장소 `models/`), 매니페스트가 리비전·해시를 고정 | 없음 | `MODEL_ROOT`, `MODEL_MANIFEST` | 매니페스트의 `image_digest` 칸은 지금 Docker 대신 가상환경 지문을 적는다 | 가중치를 이미지에 넣는가, 볼륨으로 붙이는가. 지문 계산(`serving/ops/models.py` 173~175행)이 맥 잠금을 재료로 쓴다. `image_digest`에 실제 이미지 다이제스트를 적을 수 있는가 |
| CI | 검사 4종 | `.gitlab-ci.yml`(`node:22`·`python:3.11` 이미지 위) | 없음 | 없음 | 없음 | DB 시험은 러너에 MariaDB가 있을 때만 돈다. CI 이미지에는 MariaDB가 없어 지금은 건너뛴다. CI에 DB를 어떻게 붙이는가. 이미지 빌드를 어디에 더하는가(9절) |

## 부록 B. PR 양식(1일차에 저장소에 넣는다)

```text
## 무엇을, 왜
- 이슈: #번호 / 설계서: SD_04 ○절, DEPLOY ○절
## 바꾼 것
- (파일과 한 줄 설명)
## 확인한 것
- 명령과 결과(종료 코드, 수치). 이미지를 바꿨으면 크기와 빌드 시간(바꾸기 전·후)
- 화면이 바뀌었으면 캡처
## 남은 것
- (확인하지 못한 것과 이유)
```
