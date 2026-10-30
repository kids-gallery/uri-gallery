<div align="center">

# 우리 아이 미술관

**아이 그림 사진 한 장을, 가족 미술관에 걸리는 작품으로.**

![Docker Compose](https://img.shields.io/badge/Docker_Compose-2496ED?logo=docker&logoColor=white)
![Vue 3](https://img.shields.io/badge/Vue_3.5-4FC08D?logo=vuedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_4-000000?logo=express&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![MariaDB](https://img.shields.io/badge/MariaDB_12-003545?logo=mariadb&logoColor=white)

</div>

보호자가 아이 그림을 찍어 올리면, 서버 AI가 그림을 종이에서 떼어 내고 입체 작품으로 만들어 브라우저 3D 미술관에 겁니다. 이번 5일(10-30 금 ~ 11-05 목 발표) 동안 이 서비스를 **Docker Compose 한 명령으로 뜨게** 만들고, 3D 화면을 서버에 잇습니다.

> 목표: `docker compose up -d` → 3D 미술관에서 가입 → 사진 올리기 → AI가 분리·판정·입체 → 보호자 확정 → 전시까지 한 바퀴

## 지금 상태

| 된 것 | 아직 안 된 것 |
|---|---|
| 모델 서빙(앱 서버·작업 큐·AI 모델·DB)이 한 대에서 돈다 | Dockerfile·compose 0개(이번에 팀이 직접 만든다) |
| 3D 미술관이 브라우저에서 돈다(서버 없이 기기 안에서만) | 3D 화면을 서버에 잇는 코드 |
| 리눅스 컨테이너에서 시험 통과, 웹 빌드 확인 | 배포(이번 5일 밖), 모델 정확도 평가, 실제 사용자 검증 |

## 팀

| 사람 | 맡는 일 | 폴더 |
|---|---|---|
| 최호준 | A 모델 서빙 · compose로 묶기 | `serving/` `models/` `compose.yaml` |
| 신지현(팀장) | B 입구 · 3D 화면 창 · 처음부터 띄워 보기 | `web/` 입구 nginx |
| 이제민 | C 앱 · 데이터 · 3D 화면 서버 연결 · 설계 PR · 병합 | `api/` `db/` `contracts/` |

맥은 이제민 한 대, 나머지는 Windows(WSL)입니다. 정본은 [마스터플랜 4절](design/PLAN_3인디벨롭_컨테이너협업_우리아이미술관.md)입니다.

## 할 일 보는 곳

- [**내 이슈**(첫 이슈부터)](https://github.com/kids-gallery/uri-gallery/issues?q=is%3Aissue%20is%3Aopen%20assignee%3A%40me%20sort%3Acreated-asc) · [날짜별 마일스톤](https://github.com/kids-gallery/uri-gallery/milestones) · [프로젝트 보드](https://github.com/orgs/kids-gallery/projects/2)
- 이슈 제목은 `[날짜 · 담당] 할 일`입니다. 전체 흐름과 이슈 35개는 [이슈 목록](docs/공통/이슈설계_컨테이너협업.md)에 있습니다.

## 시작하기

```bash
git clone https://github.com/kids-gallery/uri-gallery.git   # Windows는 WSL 안에서
cd uri-gallery
cd web && npm ci && npm run dev     # 3D 미술관: http://127.0.0.1:9501/app/world
```

`docker compose up -d`는 3일차에 compose가 생기면 여기에 적습니다. 폴더별 시험은 `api/`에서 `npm test`, `serving/`에서 `pytest`입니다. 막히면 [수행 가이드 "막히면"](docs/공통/수행가이드.md#막히면)을 봅니다.

## 일하는 법

1. 이슈 하나 = 가지 하나 = PR 하나. 가지는 `종류/이슈번호-설명`, 커밋은 `종류: 설명 (#이슈번호)`
2. 설계서(`design/`)를 먼저 고치고 구현합니다.
3. PR은 양식대로 올리고 본문에 `Closes #이슈번호`를 적습니다.
4. 리뷰어가 승인하면 이제민이 병합하고, 이슈는 저절로 닫힙니다. 리뷰어 확인 목록은 [마스터플랜 4-1](design/PLAN_3인디벨롭_컨테이너협업_우리아이미술관.md)에 있습니다.
5. `.env`, 비밀 값 파일(`secrets/`), 모델 가중치는 저장소에 올리지 않습니다.

## 문서 지도

| 순서 | 문서 | 무엇 |
|---|---|---|
| 1 | [마스터플랜](design/PLAN_3인디벨롭_컨테이너협업_우리아이미술관.md) | 5일 목표 · 역할 · 날짜별 할 일 · PR 검토 · 하지 않을 것 |
| 2 | [이슈 목록](docs/공통/이슈설계_컨테이너협업.md) | 이슈 35개와 순서, 이슈 보는 법·닫는 법 |
| 3 | [수행 가이드](docs/공통/수행가이드.md) | 컨테이너 구성 · 3D 연결 몫 · 날마다 쓰는 명령 · 막히면 |
| 4 | [서비스 구조와 코드](docs/공통/서비스_구조와_코드.md) | 이미 만들어진 서비스가 어떻게 작동하나, 함수 단위 코드 설명 |
| 5 | [팀 가이드](docs/공통/컨테이너배포_팀가이드.md) | 수업 교안의 어디를 이 작업에 쓰나 |
| 참고 | [SD_04 아키텍처](design/SD_04_아키텍처설계서_우리아이미술관.md) · [SD_03 DB](design/SD_03_데이터베이스설계서_우리아이미술관.md) · [작업 큐 계약](contracts/stage-job.md) · [서빙 안내](serving/README.md) | 구조·표·규칙 |

## 폴더

| 폴더 | 무엇 |
|---|---|
| `web/` | 화면(Vue). 3D 미술관은 `web/src/app/world/` |
| `api/` | 앱 서버(Express), sweeper |
| `serving/` | AI 모델 서버(FastAPI), 작업자 |
| `contracts/` | API·작업 큐 계약 |
| `design/` | 설계서, 마스터플랜 |
| `models/` | 모델 목록(가중치는 넣지 않음) |
| `ops/` | 서버 구성 |
| `docs/` | 팀원이 읽을 문서(`공통/`), 지난 기록(`기록/`), 프로그램·AI가 읽는 파일(`_claude/`) |
