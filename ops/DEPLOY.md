# 팀 서버 배포 절차 (T140, research R-02, quickstart §7)

> Docker 없음. 호스트 네이티브 프로세스를 pm2로 띄우고 Homebrew nginx가 HTTPS·라우팅을 맡는다. GitLab CI는 검사만 한다(배포하지 않는다).
> 비밀번호·키 원문은 이 문서와 커밋에 적지 않는다. 모두 서버의 `.env`(git 제외)에만 둔다.
> 팀 서버 사양·GPU·모델 경로(U2·U14)는 `docs/A_팀서버_자원확인.md` 확인 뒤 표시된 칸을 채운다.

## 1. 한 번만: 서버 준비

| 항목 | 명령 | 확인 |
|---|---|---|
| Node 20 · pm2 | `brew install node@20 && npm i -g pm2` | `node -v` → v20 |
| Python 3.11 | `brew install python@3.11` | |
| nginx · mailpit | `brew install nginx mailpit` | P0 메일은 Mailpit(R-23) |
| 저장소 | `git clone <gitlab>/project2610 ~/project2610` | 원본 한 곳에서만 운영(파생 폴더 없음) |
| 저장 영역 | `mkdir -p /srv/uam/store/{family,tmp,ext,evalset}` · 소유자는 pm2 실행 계정, 모드 750 | R-06 |
| `.env` | 저장소 루트에 `.env.example`을 복사해 채운다 | `DB_*`·`SESSION_SECRET`·`AUTH_HMAC_SECRET`(각각 `openssl rand -hex 32`)·`STORAGE_ROOT`·`MODEL_ROOT`[U14]·`GPU_ENABLED`[U2]·`MODEL_MANIFEST`·`API_GUIDE_TEST_KEY`(아래 4) |
| Python 가상환경 | `cd serving && python3.11 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.lock -r requirements-models.lock` | M3는 `.venv-m3` + TorchServe(A 문서) |
| DB 스키마 | `cd api && npm ci && npm run build && npm run db:migrate` | `0001_sd03_baseline`(= `design/uri_gallery_ddl.sql`) 재실행 안전. **팀 DB에 시험을 돌리지 않는다**(시험은 임시 MariaDB) |
| 팀원 계정 | `npm run ops:staff -- add --email <메일> --role operator[,evaluator,integrator]` (비밀번호는 표준 입력) | |
| 모델 버전 | `cd serving && .venv/bin/python -m ops.models check <Mx>` → `register <Mx> --label … --apply` → 평가·승격은 운영 화면(S11) | G21·G22 |

## 2. 매번: 배포

```bash
ssh <team-server> 'cd ~/project2610 && git pull --ff-only \
  && (cd api && npm ci && npm run build && npm run db:migrate) \
  && (cd web && npm ci && npm run build) \
  && (cd serving && .venv/bin/pip install --require-hashes -r requirements.lock) \
  && pm2 reload ops/ecosystem.config.cjs && pm2 save'
```

- `pm2 reload`는 app-api를 무중단으로 바꾼다. 워커는 `kill_timeout 10000` 안에 진행 중 작업을 끝내거나, 끝내지 못하면 sweeper 이어받기(BR-PRC-05)가 다시 잡는다.
- P0.5 llm-server는 설명 기능을 열 때만: `pm2 start ops/ecosystem.config.cjs --only llm-server`(주석 해제 뒤) + `.env`에 `CAPTION_ENABLED=true`. 공유 Ollama는 `http://127.0.0.1:11434`(IPv4)로만 부른다.

## 3. 배포 뒤 확인

```bash
curl -s https://<도메인>/live                       # {"status":"live"}
curl -s https://<도메인>/ready | jq                 # {"status":"ready","anyLoading":…} — 공개 응답엔 모델 상세 없음
pm2 status                                          # app-api · model-api · worker-cpu · worker-gpu · sweeper online
curl -s -o /dev/null -w '%{http_code}\n' https://<도메인>/v1/models/segment -X POST   # 401 (키 없음 — 외부 경로 살아 있음)
curl -s -o /dev/null -w '%{http_code}\n' https://<도메인>/internal/ready              # 404 (nginx가 내부 경로를 내보내지 않음)
```

운영 화면(S11)의 모델 상태 표에서 M1·M2·M3·M5가 `ready`인지 본다. `loading`은 오류가 아니다(A `docs/A_모델적재_화면요구.md`).

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
| — | — | — | 대기 — 팀 서버 접속 정보·사양(U2·U14) 확인 뒤 첫 배포 |
