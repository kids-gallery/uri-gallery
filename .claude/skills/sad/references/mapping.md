# 도면 지도 — 무엇이 어디에 적히는가

## 목차
1. 도면 계층과 작성 규칙 원천
2. 구현 사실 → 도면 위치
3. app-api 모듈 → UC
4. 도면 사이 사본·개수(함께 고칠 곳)
5. 흔한 함정

## 1. 도면 계층과 작성 규칙 원천

위에서 아래로 흐른다. 아래 도면을 고치면 위 도면에 근거가 있는지 먼저 본다.

| 층 | 도면(`design/`) | 작성 규칙(저장소 루트) |
|---|---|---|
| 공통 기준 | `REF_재작성공통기준_우리아이미술관.md` — §4 엔드포인트, §8 BR, §10 U, §11 통합 결정 D# | — |
| 유스케이스 | `UC_01`~`UC_15` (UseCase Diagram + 14속성 기술 + 기본흐름 + Sequence), `UC_00` 개요, `UC_ALL` 통합(UC 사본 포함) | `분석설계 프롬프트 - 유스케이스.md` |
| 프로세스 | `SD_01_프로세스설계서` — P0~P10 IPO(단계 번호 n.m), 도면, §14 인계 H#, §15 게이트 G#, §16 추적성, §17 미해결 | `분석설계 프롬프트 - 프로세스.md` |
| UI/UX | `SD_02_UIUX설계서` — S0~S12 와이어프레임(salt), 영역·상호작용·상태 전이, §2-1 역할별 메뉴 표, §16 게이트→화면 사상 | `분석설계 프롬프트 - UI_UX.md` · `design/style-guide/` |
| DB | `SD_03_데이터베이스설계서` + `uri_gallery_ddl.sql`(정본) | `분석설계 프롬프트 - 데이터베이스.md` |
| 아키텍처(모듈·이력) | `SD_04_아키텍처설계서` — 모듈 SV1~SV5·CM, §3-3 테이블 배정, §6 의존, §8 인터페이스, §9 미해결 | `분석설계 프롬프트 - 아키텍처.md` |
| 명세·계약 | `.specify/features/우리-아이-미술관/` spec(FR)·plan·data-model·tasks·`contracts/`(정본) | — |

## 2. 구현 사실 → 도면 위치

| 구현에서 찾은 사실 | 고칠 곳(순서대로) |
|---|---|
| 새 결정·규칙(동작 방식이 바뀜) | REF §11 D# 행(+ UC_ALL 같은 행) · 새 BR이면 REF §8 + UC_00 §7.1 + UC_ALL §8 + SD_01 §16-3 |
| 새·바뀐 엔드포인트 | REF §4 · 해당 UC(기본/대체/예외흐름 + Sequence 메시지) · SD_01 IPO Input 열 · contracts `openapi.yaml`(또는 `model-api.openapi.yaml`) · SD_04 §8(서빙 쪽이면) |
| 새 오류 사유 코드·거절 | UC 예외흐름 E# · SD_01 §15 게이트(해제 주체 필수, 없으면 §15-2) · SD_02 §16 · openapi `Problem.reason` 설명 |
| 새 게이트 G# | SD_01 §15 표·§15-1 성격 · SD_02 §16(개수 문구) · DDL `gate_catalog` 시드 · SD_03 §14 |
| 상태·전이 변경 | REF §5 · UC 사후조건 · SD_01 도면 · SD_02 상태 전이 절 · SD_03 CHECK |
| 테이블·컬럼·제약·트리거·뷰 | `uri_gallery_ddl.sql` → `db/migrations/0001_sd03_baseline.sql` 복사(같아야 함) · SD_03 ERD(전체 §4 + 영역 절)·엔티티 표·§14·§15·§18 개수와 검증 · SD_04 §3-3 배정 · data-model §1·§3·§4 |
| 기존 DB에 들어가야 하는 스키마 변경 | DDL 안에 멱등 ALTER(`ADD COLUMN IF NOT EXISTS`, 제약은 `DROP CONSTRAINT IF EXISTS` 뒤 `ADD`) |
| 화면·버튼·문구·라우트 | SD_02 해당 S# 와이어프레임·영역·상호작용·상태 전이 · §2-1(역할) · §2-2(지도) · `docs/C_화면문구.md` |
| 워커·어댑터·큐 규칙 | `contracts/stage-job.md`(정본·사본) · SD_04 §4~§8 · SD_01 P0(§3) |
| 서빙 모듈·배치·pm2·포트 | SD_04 · plan 기술 컨텍스트 · CLAUDE.md 기술 컨텍스트 표 |
| 기능 요구 추가 | spec FR 목록·본문·개정 이력 · tasks(새 T번호) |

## 3. app-api 모듈 → UC

children UC1 · artworks UC2·UC3·UC4·UC5 · gallery/files UC6 · deletion UC7 · ops UC8 · admin UC9 · captions UC10 · apiGuide UC11 · auth UC13·UC14 · family UC15 · model-api external UC12.

## 4. 도면 사이 사본·개수(함께 고칠 곳)

- UC 본문이 바뀌면 `UC_ALL`의 같은 UC 절(표 행·Sequence 블록)도 같게.
- REF §11 D# 행은 `UC_ALL`의 D 표에도 같은 글.
- 계약: `.specify/.../contracts/*`가 정본, 루트 `contracts/*`는 사본(차이 0).
- DDL: `design/uri_gallery_ddl.sql` = `db/migrations/0001_sd03_baseline.sql`(`db/tests/ddl.verify.test.ts`가 비교). 테이블·뷰·트리거 개수는 이 시험, SD_03 §18, SD_04 §3-3 제목, data-model §1 제목, plan, CLAUDE.md에 적혀 있다.
- 게이트 개수: SD_01 §15, SD_02 머리·§16("N개 전건 G0~Gn"), DDL 시드.
- BR 개수: REF §11 끝 문장, UC_00 §7·요약 표, UC_ALL §8·요약 표, SD_01 §16-3 끝 문장.
- 도면 목록: SD_01 §16-4(도면 수 문장), SD_02 "도면 목록과 렌더 검증".
- 문서 머리 `> **개정 (날짜, 근거)**:` 줄과 꼬리 `*… 개정 날짜 …*` 줄.

## 5. 흔한 함정

- **salt 와이어프레임 중괄호**: 블록을 끼워 넣을 때 `}` 하나가 더 닫히면 뒤 블록이 통째로 사라진다. HTTP 200이어도 PNG로 확인한다(`puml_sync.py --png`).
- **링크 인코딩**: 기존 링크는 다른 인코딩일 수 있다. 바꾼 블록의 링크만 갱신한다(스크립트가 그렇게 한다).
- **표 중간 빈 줄**: 마크다운 표에 행을 끼울 때 빈 줄이 들어가면 표가 끊긴다.
- **origin·상태 목록 하드코딩**: 새 값(예: `stage_job.origin`)이 생기면 뷰·app-api 지표 쿼리·sweeper·워커 점유 조건에 같은 목록이 흩어져 있다 — `grep -rn "<값 목록 일부>" api/src serving design`으로 전부 찾는다.
