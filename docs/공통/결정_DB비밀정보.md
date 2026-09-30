# 결정: 팀 DB 비밀번호 취급 (T012, research R-21)

> 기록: B 이제민 · 2026-09-28

## 상황

`Intent-Plan.md` 작업 사본(커밋되지 않은 수정)에 팀 MariaDB(`ABC10pioneer1`) 접속 비밀번호가 평문으로 적혀 있었다. git 이력에는 들어간 적이 없다(작업 사본에만 있었음).

## 결정

1. 비밀번호는 문서·커밋 어디에도 적지 않는다. 접속 정보는 저장소 루트 `.env`(git 제외)에서만 읽는다. 키 이름은 `.env.example`의 `DB_HOST`·`DB_PORT`·`DB_USER`·`DB_NAME`·`DB_PASSWORD`.
2. `Intent-Plan.md` 작업 사본의 비밀번호는 `.env` 참조 문장으로 바꿨다(2026-09-28, B).
3. `archive/intent-backup/Intent-Plan-backup.md`(추적 안 됨 — `archive/`는 .gitignore)에는 원문이 남아 있다 — **커밋하지 않는다**. 필요 없으면 작성자가 지운다.
4. 시험은 팀 DB가 아니라 임시 MariaDB로만 돌린다(api `tests/helpers/globalSetup`, serving `tests/conftest.py`).
5. 문서·계획서·quickstart·`ops/DEPLOY.md`는 `DB_PASSWORD=` 빈 값과 "문서·커밋에 적지 않음"만 적는다.

## 남은 일

- 원문이 한 번이라도 공유 문서에 노출됐으므로, 팀 DB 관리자가 비밀번호를 바꾸는 것이 안전하다(권고, 팀 결정 필요).
- `Intent-Plan.md` 작업 사본 수정분은 작성자 확인 뒤 커밋한다(B는 남의 파일을 커밋하지 않는다).
