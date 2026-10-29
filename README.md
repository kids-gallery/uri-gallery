<div align="center">

# 우리 아이 미술관

**아이 그림 사진 한 장을, 가족 미술관에 걸리는 작품으로.**

![Vue 3](https://img.shields.io/badge/Vue_3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_4-000000?logo=express&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB-003545?logo=mariadb&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?logo=pytorch&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-000000?logo=threedotjs&logoColor=white)

[지금 상태](#2-지금-상태) · [빠른 실행](#3-빠른-실행) · [코드 설명](#4-코드-설명) · [배경지식](#5-배경지식) · [앞으로 할 일](#6-앞으로-할-일) · [역할 분배](#7-역할-분배-가이드라인) · [문서 지도](#8-문서-지도)

</div>

## 1. 무엇을 하나

쌓여 가는 아이의 작품을 디지털 미술관에 **기록하고, 전시하고, 큐레이션**한다. 보호자가 그림 사진을 올리면 공개 모델들이 배경을 지우고, 사람 그림인지 살피고, 입체나 움직이는 그림으로 바꿔 나이별 전시실에 건다.

지키는 원칙은 하나다. **접수된 그림은 결과 없이 끝나지 않는다.** 올리는 순간 원본 액자로 먼저 걸고, 모델이나 엔진이 실패하면 그 원본 액자가 결과로 남는다. 점수로 자동 결정하지 않고, 모델은 제안만 하며 보호자가 고른다.

**팀 목표.** 도커 컨테이너로 감싼 모델 서비스가 설계한 대로 핵심 기능을 안정적으로 수행한다. 지금은 컨테이너 없이 한 대에서 흐름이 한 바퀴 도는 단계이고, 컨테이너 구성은 팀 작업이다([6절](#6-앞으로-할-일)).

## 2. 지금 상태

2026-10-29, 맥(arm64) 한 대에서 확인했다. 방법은 표의 오른쪽 칸에 적었다.

**되는 것**

| 항목 | 확인 방법 | 결과 |
|---|---|---|
| 올리기 → 처리 → 결과 → 전시실 | 실제 그림 2장(Animated Drawings 예제 `garlic.png`, 팀 견본 집 그림)을 API로 올리고 확정·확인 | 분리·판정 12~16초, 입체 확정 뒤 2~4초, 움직임 확정 뒤 18.1초. 확인하면 "전시 중"이 되고 전시실 목록(`GET /v1/gallery`)에 그린 날 순으로 나온다 |
| 엔진이 멈췄을 때 원본 액자 | 움직이는 그림 엔진을 멈추고 같은 그림을 올림 | 판정이 3회 시도 뒤 87초에 실패, 작품은 원본 액자로 남음 |
| 모델 4종 켜기(M1·M2·M3·M5) | 개발 도구 `scripts/dev_activate_models.py` | 네 모델 평가가 이 기기에서 돎 |
| 웹 단위 시험·타입 검사 | `cd web && npx vitest run`, `npx vue-tsc --noEmit` | 408/408 통과, 타입 오류 0 |
| 웹 배포 빌드 | `cd web && npm run build` | 성공 |
| 화면 시각 체계 | 토큰 파일과 공통 컴포넌트 7개, 단위 시험이 대비 4.5:1을 다시 계산 | 완료. 화면에는 아직 적용하지 않음 |

**안 되는 것**

| 항목 | 지금 | 어디서 다루나 |
|---|---|---|
| E2E 시험 | 62개 중 33개 실패. 같은 33개가 2026-10-29 정리 전에도 실패했다 | [E2E 알려진 실패](docs/공통/E2E_알려진실패_20261029.md), 6절 |
| M3이 없는 기기의 처리 | 움직이는 그림 엔진이 없으면 분리·판정 작업이 생기지 않아 원본 액자로만 걸린다 | 6절 팀 안건 |
| 3D 세계와 서버 연결 | `/app/world`는 그 기기 브라우저에만 저장한다. 서버 API를 부르지 않는다 | 6절 흐름 완성 |
| 컨테이너·배포 | 없다 | 6절 |

**미검증**

| 항목 | 이유 |
|---|---|
| 움직이는 그림 엔진이 x86 서버에서 도는지, 추론 중 메모리 최대치 | x86 기기가 없었다 |
| 같은 아이 작품 여러 장이 여러 나이 전시실을 채우는 모습 | 나이를 넣은 아이로 시험하지 않았다(두 장은 "나이 미정"에 걸림) |
| 판정 품질 | 팀 평가 묶음 사진이 이 기기에 없어, 평가는 연결 확인용 그림으로만 돌렸다 |

## 3. 빠른 실행

도커 없이 한 대에서 띄우는 방법이다. 설치 단계 전체와 설정 값은 [팀작업 시작 안내](docs/공통/팀작업_시작안내.md) 2~4절에 있고, 여기에는 매번 하는 것만 둔다.

```bash
# 저장소 루트. 준비(한 번): MariaDB·Mailpit 설치, .env 작성, npm ci, api 빌드·db:migrate, serving/.venv
set -a; . ./.env; set +a
npx pm2@6.0.14 start ops/server/ecosystem.config.cjs --only app-api,model-api,worker-cpu,sweeper
npx pm2@6.0.14 start ~/.local/bin/mailpit --name mailpit --interpreter none -- --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025 --database .data/mailpit.db
cd web && APP_API_URL=http://127.0.0.1:9521 npx vite --port 9613
```

- 화면 `http://127.0.0.1:9613/app/`, 3D 세계 `/app/world`, 받은 메일 `http://127.0.0.1:8025`
- 모델 켜기(개발 DB 전용, 한 줄): `serving/.venv/bin/python scripts/dev_activate_models.py`
- 움직이는 그림 엔진(M3) 설치: [팀작업 시작 안내 3절](docs/공통/팀작업_시작안내.md#3-움직이는-그림-엔진m3-설치맥-도커-없이), 원 기록은 [A_모델재현기록 M3절](docs/A/A_모델재현기록.md)

**자주 막히는 곳**

| 증상 | 원인 | 해결 |
|---|---|---|
| 가입 확인 메일이 안 옴 | 다른 Mailpit(예: 남은 컨테이너)이 8025를 잡아 새 Mailpit이 못 뜸 | `lsof -iTCP:8025 -sTCP:LISTEN`으로 확인하고 먼저 뜬 것을 멈춘다 |
| `db:migrate`가 트리거에서 실패 | MariaDB가 함수·트리거 생성을 막음 | DB에서 `SET GLOBAL log_bin_trust_function_creators=1`(재시작하면 다시) |
| 올려도 처리 작업이 0건 | 활성 모델 버전이 없거나 M3이 꺼짐 | 모델 켜기 한 줄을 돌리고, M3을 설치해 TorchServe를 띄운다 |
| 모델을 켰는데 워커가 안 올림 | 워커는 기동 때만 미리 올린다 | 개발 도구가 "지금 불러오기"까지 부른다. 손으로 켰다면 `npx pm2@6.0.14 restart worker-cpu` |
| mmcv-full 빌드 실패(`-Winvalid-specialization`) | 새 Xcode clang이 torch 1.13 헤더를 오류로 막음 | `CFLAGS`·`CXXFLAGS`에 `-Wno-invalid-specialization`(설치 안내 3절) |
| 9501 포트가 이미 쓰임 | 다른 개발 서버 | `--port`로 다른 포트를 준다 |
| E2E 뒤 `docs/B/카카오로그인_캡처/`가 바뀜 | 시험이 캡처를 다시 쓴다 | 바꿀 뜻이 없으면 커밋 전에 되돌린다 |

## 4. 코드 설명

### 폴더 구조

```text
api/        보호자·운영 API(Express 4, TypeScript). 접수·확정·전시실·가입·운영 화면 API, 작업 정리기(sweeper)
serving/    모델 서빙(Python). 워커(작업 처리), 모델 어댑터, model-api(FastAPI), 운영 도구, 잠금 파일
web/        화면(Vue 3.5 + Vite). 보호자 2D 화면, 3D 세계(three.js), 운영 화면, 단위 시험, E2E
db/         마이그레이션(정본 스키마 0001)과 DB 시험
contracts/  API 계약(openapi.yaml), 모델 API 계약, 작업 계약(stage-job.md), 설명 생성 계약
models/     모델 매니페스트(manifest.yaml: 출처·판·해시·라이선스 확인). 가중치는 저장소에 없다
caption/    작품 설명 문장 규칙(P0.5, 지금 꺼짐)
eval/       평가 묶음 목록(사진은 팀 공유 위치)과 평가 실행기
ops/        배포 구성(pm2·nginx·TorchServe 설정), 점검표, 팀 서버 기록
scripts/    개발 도구(모델 켜기, 에셋 생성)
design/     설계서 SD_01~04, 유스케이스 UC_00~13, 스타일 가이드, 시안·진단
docs/       작업 기록. A 모델 재현, B 통합 시험, C 화면 문구, D 모델 시험, 공통(팀 안내·결정)
제출/        팀 제출물(계획서·발표 자료)
```

### 핵심 흐름을 따라가는 코드 지도

그림 한 장이 지나가는 순서다. 작업(`stage_job`)은 DB 표 하나가 큐 역할을 한다.

| 단계 | 무슨 일 | 담당 파일 |
|---|---|---|
| 1 올리기 | 보호자가 사진을 고르고 올린다 | `web/src/app/views/UploadView.vue` → `web/src/api/client.ts` |
| 2 접수 | 사진 저장, 원본 액자로 먼저 걸기, 분리(`split`)·판정(`judge`) 작업 만들기. M1·M2·M3이 모두 활성일 때만 작업을 만든다 | `api/src/modules/artworks/routes.ts`(`POST /v1/artworks`, `intakeTx`), `api/src/modules/artworks/models.ts`(`JUDGE_MODELS`) |
| 3 작업 가져가기 | 워커가 `FOR UPDATE SKIP LOCKED`로 한 건을 잡고 60초 점유, 20초마다 연장 | `serving/workers/main.py`, `serving/workers/runner.py`(`claim`, `process`) |
| 4 분리(M1) | 배경을 지워 그림만 잘라 낸다 | `serving/workers/stages/split.py`, `serving/adapters/m1_birefnet.py` |
| 5 판정(M2·M3·M4) | 종류를 보고(M2), 관절을 찾고(M3), 규칙(M4)으로 움직임·입체·액자 중 하나를 제안 | `serving/workers/stages/judge.py`, `serving/adapters/m2_openclip.py`, `serving/adapters/m3_joints.py`, `serving/config/m4_rules.yaml` |
| 6 확정 | 보호자가 고른다. 고른 결과에 맞는 작업을 만든다 | `web/src/app/views/ConfirmView.vue`, `api/src/modules/artworks/routes.ts`(`confirmTx`) |
| 7 결과 | 움직임(M3 렌더), 입체(M5 깊이), 원본 액자 | `serving/workers/stages/results.py`, `serving/adapters/m3_render.py`·`m3_ad_run.py`, `serving/adapters/m5_depth.py` |
| 8 실패와 대체 | 인프라 실패는 3회(10초·60초 뒤) 시도, 끝내 실패하면 낮춘 결과나 원본 액자. 점유가 끊긴 작업은 정리기가 닫는다 | `serving/workers/chain.py`, `serving/workers/outcome.py`, `serving/config/limits.yaml`, `api/src/sweeper/` |
| 9 확인 | 보호자가 결과를 보고 확인한다 | `web/src/app/views/ReviewView.vue`, `api/src/modules/artworks/routes.ts`(`POST /v1/artworks/:id/decision`) |
| 10 전시실 | 나이 묶음별, 그린 날 순으로 보인다 | `api/src/modules/gallery/routes.ts`(`GET /v1/gallery`, 뷰 `v_gallery`), `web/src/app/views/MuseumView.vue` |

- 단계 이름과 모델의 짝은 `serving/adapters/registry.py`(`STAGE_MODELS`) 한 곳에 있다.
- 단계별 시간 상한은 `serving/config/limits.yaml`에 있다(분리 60초, 판정 120초, 움직임 600초, 입체 CPU 600초).
- 워커와 app-api는 HTTP로 서로 부르지 않는다. DB 표로만 주고받는다(`contracts/stage-job.md`).

### 데이터

정본은 [SD_03 데이터베이스 설계서](design/SD_03_데이터베이스설계서_우리아이미술관.md)와 DDL `design/uri_gallery_ddl.sql`(= `db/migrations/0001_sd03_baseline.sql`)이다. 흐름에 쓰는 핵심 표는 다음과 같다.

| 표 | 무엇 |
|---|---|
| `family`, `child` | 가족 공간과 아이(별칭만) |
| `artwork`, `stored_object`, `artwork_original` | 작품 한 점, 저장한 파일, 원본 사진 |
| `stage_job` | 처리 작업 큐(단계·서빙군·시도 횟수·오류 종류) |
| `judgment`, `result`, `decision`, `artwork_outcome` | 판정 제안, 결과물, 보호자 확인, 최종 결과 기록 |
| `model_version`, `evaluation`, `eval_item`, `release_event` | 모델 판, 평가, 평가 항목, 승격 기록 |
| `v_gallery`(뷰) | 전시실에 보일 작품 |

- 작품 상태(`artwork.status`): `received` → `judging` → `awaiting_confirm` → `processing` → `awaiting_review` → `approved`. 그 밖에 `failed`, `deleting`. 보호자 화면의 상태 이름(`exhibited` 등)은 API가 바꿔 보낸다(`contracts/openapi.yaml`).
- 작업 상태(`stage_job.status`): `queued`, `running`, `done`, `done_downgraded`, `retry_wait`, `failed`, `cancelled`. 전이 규칙은 `contracts/stage-job.md`.

### 디자인 규칙

- 톤: 3D 세계 안의 아이에게는 게임처럼(걷기·폴짝, 작품 반응, 크레용 인형, 효과음), 공간·재질은 사실적 미술관 그대로. 보호자 화면과 3D 위 안내 패널은 미술관 톤(넓은 여백, 글자 위계, 작품 중심, 쉬운 말). 기준은 [SD_02 17-20](design/SD_02_UIUX설계서_우리아이미술관.md).
- 토큰 파일은 `web/src/styles/w-tokens.css` 하나다. 밝은 판(보호자 2D)과 어두운 판(`.w-dark`, 3D 위 패널).
- 공통 컴포넌트 7개: `web/src/components/w/`의 `WButton`·`WCard`·`WInput`·`WTopBar`·`WEmpty`·`WLoading`·`WError`. 클래스는 `w-` 접두(`web/src/styles/w-components.css`).
- 토큰 밖의 색·크기·그림자를 쓰지 않는다. `web/src/__tests__/w-design.spec.ts`가 확인한다.
- 화면 문구 정본은 `docs/C/C_화면문구.md`다. 보호자 화면에는 처리 용어(막힘·사유·해제 주체)를 쓰지 않는다.

## 5. 배경지식

**모델 서빙의 동기와 비동기.** 결과가 몇 초 안에 나오면 요청을 받은 자리에서 바로 답한다(동기). 수십 초에서 몇 분 걸리면 요청을 작업으로 적어 두고 곧바로 "접수했어요"라고 답한 뒤, 따로 도는 워커가 처리한다(비동기). 이 서비스는 올리기를 202(접수)로 답하고 DB 표 `stage_job`을 큐로 쓴다. 작업마다 시간 상한이 있고, 인프라 실패는 정해진 간격으로 다시 시도하며, 끝내 실패하면 더 단순한 결과로 낮추거나 원본 액자로 대체한다. 참고: [MariaDB SELECT … SKIP LOCKED](https://mariadb.com/kb/en/select/), [FastAPI](https://fastapi.tiangolo.com/).

**이 프로젝트의 모델들.** 출처와 판은 `models/manifest.yaml`이 정본이다.

| 모델 | 출처 | 하는 일 | 지금 |
|---|---|---|---|
| M1 | [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) | 배경을 지워 그림만 잘라 낸다 | 켬 |
| M2 | [OpenCLIP](https://github.com/mlfoundations/open_clip) ViT-B-32 | 그림의 종류(사람·사물 등)를 본다 | 켬 |
| M3 | [Animated Drawings](https://github.com/facebookresearch/AnimatedDrawings) | 그린 사람의 관절을 찾고 움직이는 그림을 만든다 | 켬(맥 네이티브) |
| M4 | 규칙 파일 `serving/config/m4_rules.yaml` | M2·M3 결과로 제안을 정한다 | 코드 |
| M5 | [Depth Anything V2 Small](https://github.com/DepthAnything/Depth-Anything-V2) | 깊이를 추정해 입체 부조를 만든다 | 켬 |
| M6 | Qwen3 4B(Ollama) | 작품 설명 문장 | 꺼짐(라이선스 확인 전) |
| M7 | TripoSR | 점토·종이 입체 | 꺼짐(라이선스 확인 전) |

**Animated Drawings와 x86 문제.** M3은 2025-09 보관 처리된 저장소다. 이 저장소는 커밋 `b859684`에 고정해 쓴다. 관절 검출은 TorchServe가 띄우는 두 모델(`.mar`)이 하고, 움직임 렌더는 워커가 AD 전용 파이썬 환경을 하위 프로세스로 부른다. 환경이 오래된 판(Python 3.8, torch 1.13, mmcv-full 1.7.0)이라 기기마다 설치가 쉽게 깨진다. 지금 잠금 파일(`serving/conda-m3.lock`)은 맥(arm64) 전용이다. x86 리눅스 서버에서 같은 환경이 도는지는 미검증이고, 배포 전에 확인할 1순위다. 참고: [TorchServe](https://pytorch.org/serve/).

**three.js 기본.** 화면 하나는 장면(Scene, 물체를 담는 공간), 카메라(Camera, 어디서 보나), 렌더러(Renderer, 매 프레임 그리기)로 이뤄진다. 조작은 입력(키보드·터치)을 받아 캐릭터와 카메라 위치를 매 프레임 바꾸는 것이다. 3D 세계 코드는 `web/src/app/world/`에 있다. 참고: [three.js 매뉴얼](https://threejs.org/manual/).

**Vue 구조.** 화면 하나는 `.vue` 파일 하나(템플릿·스크립트·스타일)다. 주소와 화면의 짝은 `web/src/router/index.ts`, 공통 상태는 `web/src/stores/`(Pinia), API 호출은 `web/src/api/client.ts`, 화면 문구는 `web/src/copy/ko.ts`에 모았다. 참고: [Vue 가이드](https://vuejs.org/guide/introduction.html).

**도커가 필요한 이유.** 지금은 MariaDB·Mailpit·Python 환경 두 개(모델용, AD용)·Node를 기기마다 손으로 깐다. 특히 AD 환경은 컴파일러 판에 따라 빌드가 깨진다(3절 표). 컨테이너는 이 설치를 이미지로 굳혀, 어느 기기에서나 같은 환경을 한 명령으로 띄우게 한다. 팀 작업은 서비스별 이미지, 개발·배포 묶음, 망 분리, 엔진 이미지를 x86 서버에서 돌리는 것이다(6절). 참고: [Docker 시작하기](https://docs.docker.com/get-started/), [Compose](https://docs.docker.com/compose/).

## 6. 앞으로 할 일

우선순위 순이다. 자세한 끝나는 조건은 [팀작업 시작 안내 7절](docs/공통/팀작업_시작안내.md#7-팀-작업-목록)에 있다.

| # | 작업 | 왜 필요한가 | 선행 조건 | 완료 기준 |
|:--:|---|---|---|---|
| 1 | 화면별 디자인 적용(입구·인증 / 보호자 / 운영) | 화면마다 색·간격·버튼이 제각각이다(진단 원인 2·3) | 없음(토큰·컴포넌트 있음) | `design/디자인진단_20261029.md` 점검표를 다시 돌려 적용한 화면 모두 "문제 없음", 전후 캡처 |
| 2 | 핵심 흐름 완성(확정 → 결과 → 전시실 정렬, 실패 시 원본 액자, 3D 세계 서버 연결) | 3D 세계가 아직 서버를 쓰지 않고, 나이별 전시실은 두 장으로만 확인했다 | 안건 1·2 결정 | 실제 그림으로 정상·엔진 실패 두 경우, 같은 아이 작품 여러 장이 나이별로 쌓임 |
| 3 | E2E 33건 갱신(올리면 곧바로 걸리는 흐름 D46) | 시험이 지금 흐름을 따라가지 못해 새 실패를 가려내기 어렵다 | 없음 | 알려진 실패 목록이 비고 새 실패 없음 |
| 4 | 게임 요소 이전·발전(크레용 인형·이동·감정 표현 바퀴, 설계 2-24·2-25) | 아이가 3D 세계를 게임으로 알아보게 한다 | 없음 | 요소별 본질 검사 표, 실제 창 캡처. 조작 참고는 [온라인 산사](https://sansa-online-temple.vercel.app) 분석 |
| 5 | 도커 컨테이너 구성(팀 공동) | 설치를 이미지로 굳혀 재현한다 | 안건 4·6 | 깨끗한 기기에서 한 명령으로 뜨고 흐름이 한 바퀴 돎 |
| 6 | 배포, 움직이는 그림 엔진 x86 검증 | 배포 서버가 x86이면 M3이 도는지부터 확인해야 한다 | 안건 3·4·5 | 정한 서버에서 흐름 한 바퀴, 추론 중 메모리 최대치 기록 |

**팀 결정 안건**(자세히는 [팀작업 시작 안내 8절](docs/공통/팀작업_시작안내.md#8-팀-안건))

| # | 안건 |
|:--:|---|
| 1 | 모델이 일부만 켜졌을 때 가능한 처리를 진행할지(지금은 M3 하나가 없으면 분리도 멈춘다) |
| 2 | 엔진이 멈춘 동안 "움직임" 선택지를 보일지 |
| 3 | 움직이는 그림 엔진이 x86 서버에서 도는지 |
| 4 | 엔진 이미지 저장소(레지스트리) |
| 5 | 배포 서버 |
| 6 | 망 분리(입구가 DB·워커·엔진에 닿지 못하게) |

## 7. 역할 분배 가이드라인

나누는 단위는 6절의 작업 묶음이다. 폴더 범위가 겹치지 않게 나눴다.

| 단위 | 맡는 범위 | 담당 |
|---|---|---|
| 화면 적용 | `web/src/app/views/`, `web/src/layouts/`, `web/src/ops/`, `web/src/styles/`(`w-*` 제외) | 담당: ____ |
| 흐름 완성 | `api/src/modules/artworks/`·`gallery/`, `serving/workers/`, `web/src/app/world/`의 서버 연결 층 | 담당: ____ |
| E2E | `web/e2e/`, `docs/공통/E2E_알려진실패_20261029.md` | 담당: ____ |
| 게임 요소 | `web/src/app/world/`(서버 연결 층 제외) | 담당: ____ |
| 도커 | `Dockerfile`들, `compose*.yaml`, `.dockerignore`, `ops/docker/` | 담당: ____ |
| 배포 | `ops/server/`, 배포 서버 설정, 엔진 x86 검증 기록 | 담당: ____ |

**겹치는 영역은 바꾸기 전에 팀 채널에 알린다.** 공통 컴포넌트(`web/src/components/w/`, `web/src/styles/w-tokens.css`), DB 마이그레이션(`db/migrations/`), API 계약(`contracts/`).

**공통 규칙**

- 설계서 먼저: 설계서(`design/`)를 고친 뒤 구현하고, 구현이 설계와 달라지면 설계서를 다시 맞춘다. PR 본문 "설계서" 칸에 고친 절을 적는다.
- 가지 이름은 `종류/이슈번호-설명`(종류: `feat`·`fix`·`docs`·`refactor`·`test`·`chore`), 커밋 제목은 `종류: 내용 (#이슈번호)`. 리뷰봇(`.github/review-bot/rules.json`)이 확인한다.
- PR은 작게. 바뀐 줄이 300줄을 넘으면 리뷰봇이 경고하고 600줄을 넘으면 막는다(잠금 파일 제외).
- 리뷰 1명 이상 뒤에 병합한다. `main`에 직접 올리지 않는다.
- 토큰 밖 색·그림자를 쓰지 않는다.
- E2E 알려진 실패 목록 밖의 새 실패를 만들지 않는다.
- 가짜 성공 금지. 모델이나 엔진이 실패하면 실패로 기록하고 원본 액자로 대체한다.
- 비밀값을 커밋하지 않는다. `.env`·`.env.*`(`.env.example` 제외)·가중치 파일(`.mar`·`.safetensors` 등)은 리뷰봇이 막는다.

## 8. 문서 지도

| 질문 | 볼 문서 |
|---|---|
| 지금 무엇이 되고, 어떻게 띄우고, 무엇을 나눠 맡나 | [팀작업 시작 안내](docs/공통/팀작업_시작안내.md) |
| 어떤 E2E가 원래부터 실패하나 | [E2E 알려진 실패](docs/공통/E2E_알려진실패_20261029.md) |
| 사용자 흐름과 처리 절차 | [SD_01 프로세스 설계서](design/SD_01_프로세스설계서_우리아이미술관.md), 유스케이스 `design/UC_00~13` |
| 화면·톤·디자인 시스템 | [SD_02 UI/UX 설계서](design/SD_02_UIUX설계서_우리아이미술관.md) 17-20 |
| 표와 상태 | [SD_03 데이터베이스 설계서](design/SD_03_데이터베이스설계서_우리아이미술관.md) |
| 구성·모델 켜기·장애 처리 | [SD_04 아키텍처 설계서](design/SD_04_아키텍처설계서_우리아이미술관.md) 9-4 |
| API와 작업 규칙 | [`contracts/openapi.yaml`](contracts/openapi.yaml), [`contracts/stage-job.md`](contracts/stage-job.md) |
| 모델 재현과 M3 설치 원 기록 | [A_모델재현기록](docs/A/A_모델재현기록.md) |
| 처음 모델을 켠 예외 기록 | [D_모델_임시활성](docs/D/D_모델_임시활성_2026-09-29.md) |
| 화면 문구 | [C_화면문구](docs/C/C_화면문구.md) |
| 서빙 환경 설치 | [`serving/README.md`](serving/README.md) |
