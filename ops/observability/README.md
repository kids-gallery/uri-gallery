# 격리 운영 시험 (#103~#113)

Docker Desktop + WSL, Node 22, Python 3.11+, Compose의 `!override`/`!reset` 지원이 필요하다. 검증 환경은 Docker 29.9.2 / Compose 5.6.1 / linux amd64다. 합성 데이터 전용이며 공개 운영에 적용하지 않는다.

## 기동

`private/grafana_password`에 무작위 비밀번호를 만들고 `collected/` 디렉터리를 만든다. 비밀 파일은 커밋하지 않는다. Grafana의 기존 볼륨에서는 파일만 바꾸어 암호가 갱신되지 않는다. 저장소의 secrets 안내대로 시험용 db_password/session_secret/auth_hmac_secret과 별도의 db_root_password를 만든다. root와 앱의 값을 다르게 둔다.

저장소 맨 위에서:

```sh
docker compose -p uri-gallery-ops-app1104 -f compose.yaml -f ops-test.override.yaml up -d --build
docker compose -f ops/observability/compose.yaml up -d
node ops/observability/collect.mjs uri-gallery-ops-app1104 ops/observability/collected
```

collector는 별도 터미널에서 실행한다. 지정 프로젝트 네 서비스 stdout JSON만 읽어 정제하며 stderr·nginx·DB·메일 원문은 제외한다. Docker socket을 컨테이너에 연결하지 않는다. `collected/`에 원문을 직접 넣으면 안 된다. Grafana는 `http://127.0.0.1:13001`, 계정 admin과 위 파일 암호로 연다. Loki/Alloy는 호스트 포트가 없다. 시험 앱은 loopback 19501, Mailpit은 loopback 18025다.

정제기는 timestamp/level/service/environment/event/durationMs/httpStatus와 검증된 추적 ID만 남긴다. 요청/작업 ID는 인덱스 라벨로 쓰지 않는다. API가 해시한 요청 ID와 UUID 형식만 수집한다. 정제 파일은 서비스별 약 5MB×3이다. Docker 원시 로그는 10MB×3이다. 합계가 호스트 디스크 하드 한도라는 뜻은 아니다.

## 시험 순서

다른 세션이 같은 시험 스택을 조작하는 동안 실행하지 않는다. 원래 워커로 복귀하는 finally 절이 있으나 실패 뒤에도 상태를 확인한다.

```sh
node --test ops/observability/*.test.mjs
python3 ops/observability/flow-check.py
python3 ops/observability/crash-check.py
node ops/observability/dashboard-check.mjs
node ops/observability/monitor-check.mjs
node ops/observability/measure.mjs uri-gallery-ops-app1104
```

flow는 두 합성 가족의 접근, 중복 접수, 워커 정지·재개와 원본 보존을 확인한다. crash는 가짜 split을 20초 늦추고 running을 확인한 뒤 SIGKILL한다. 화면의 선택지 표시를 완료로 보지 않고 실제 작업 done과 재시도 횟수를 확인한다.

두 환경 비교에는 resolved Compose JSON을 보안 폴더에 저장해 다음을 실행한다. 이 JSON에 비밀 값이 들어갈 수 있으므로 출력·PR 첨부하지 않는다.

```sh
node ops/observability/isolation.mjs test-resolved.json production-resolved.json
```

프로젝트·볼륨·망·비밀 파일·쓰기 bind mount·외부 DB 대상·시험 포트 공유를 검사한다. 경로/DNS alias와 실제 운영 권한은 별도다. UAM_ENV=production은 가짜 모델·개발 활성화를 거부하고 앱은 HTTPS·보안 쿠키·명시적 SMTP·비밀 길이를 확인한다. 기본 개발 Compose는 운영 배포본이 아니다.

## 백업·복원·되돌리기

```sh
python3 ops/observability/snapshot.py backup uri-gallery-ops-app1104 /absolute/private/new-snapshot
python3 ops/observability/snapshot.py restore uri-gallery-ops-restore-NEW /absolute/private/new-snapshot /absolute/private/deletion-ledger.json
python3 ops/observability/rollback-check.py
```

snapshot은 네 쓰기 서비스 정지 → DB dump와 작품/워커 상태 tar → manifest/체크섬 → 서비스 재개 순서다. 시험 snapshot은 암호화되지 않아 운영 데이터에 쓰면 안 된다. 폴더는 0700이다. 키는 내보내지 않으므로 별도 보관해야 한다.

`encrypted-backup.py`는 이 일관된 snapshot 폴더를 Restic 0.19.1로 암호화 저장한다. 로컬 격리 시험에서는 절대 경로의 빈 저장소, 비밀번호 파일, snapshot 폴더를 준비한 뒤 `init REPOSITORY PASSWORD_FILE EXISTING_DIRECTORY`, `backup REPOSITORY PASSWORD_FILE SNAPSHOT_DIRECTORY`, `check REPOSITORY PASSWORD_FILE EXISTING_DIRECTORY`, `restore REPOSITORY PASSWORD_FILE NEW_DIRECTORY` 순으로 호출한다. `restore` 결과는 `NEW_DIRECTORY/snapshot/`에 놓인다. 비밀번호와 원본 snapshot은 저장소 밖에 따로 보호한다. 백업 직후 `check --read-data`와 새 위치 복원·manifest 검사를 수행해야 한다.

별도 클라우드 후보는 AWS S3 서울 리전이다. 계정과 버킷이 준비되면 공개 접근 차단, 전용 최소 권한, 버전·만료 규칙, 복구 담당자의 읽기 권한을 확인하고 Restic 저장소 주소를 `s3:` URL로 지정한다. 스크립트는 호출 환경의 AWS 자격 증명을 컨테이너에 전달한다. 비밀 값은 명령 인수나 운영 기록에 넣지 않는다. 현재 S3 계정·버킷·자격 증명이 없어 실제 업로드/복원, 일정 실행, 실패 통지는 검증 대기다. 로컬 snapshot을 만든 뒤 클라우드에 넣기 전까지는 평문 파일이 호스트에 있으므로 실제 가족 데이터에 적용하지 않는다.

삭제 이력은 `{"snapshotHash":"manifest.json SHA-256","artworkIds":[1]}`이다. snapshot 이후 실제 접수된 삭제를 독립 이력에서 모은다. 빈 목록도 확인해서 명시한다. 해시는 서명이나 이력의 진실성 보장이 아니다. 복원은 컨테이너·볼륨이 없는 새 restore 프로젝트만 허용한다. 메일·외부 포트를 닫고 DB/파일 복원, 세션/메일 토큰 무효화, 작업 lease 만료, 삭제 재적용을 한다. `restore-check.py`는 validation-runtime/snapshot1을 사용하는 합성 회귀 절차다.

rollback은 실패 이미지에서 이전 이미지 ID로 복귀한 뒤 인증 조회·작품/파일 개수를 확인한다. 비호환 DB 마이그레이션을 되돌리는 시험은 아니다. 운영에서는 이전 앱 호환성·snapshot을 먼저 확인한다.

## 알림과 보관

```sh
node ops/observability/monitor.mjs ops/observability/collected/collector.jsonl ops/observability/validation-runtime/alerts.jsonl uri-gallery-ops-app1104
docker compose -f ops/observability/retention.compose.yaml up -d
node ops/observability/retention-check.mjs
```

monitor는 DB/워커 Docker health, 큐 최장 대기(기본 60초), collector heartbeat를 10초 간격으로 보고 2회 연속 실패 때 1회 경보, 복구 때 1회 통지를 남긴다. 큐 scrape 불가도 장애다. OPS_ALERT_WEBHOOK이 있으면 JSON을 전송하고 전송 실패는 로컬에 남긴다. 실제 수신 채널은 개인 카카오톡 '나에게 보내기'로 선택됐지만 발송 계정·동의·토큰이 없어 아직 연결되지 않았다. downstream Loki 전체 전달·디스크 부족·호스트 밖 생존 감시는 후속 검증이다.

Loki 본 시험은 보관과 조회 상한을 7일 초안으로 설정하고 compactor 상태는 영속화한다. 별도 retention 시험은 48시간 조회 상한에서 25시간 전 합성 로그를 저장한 뒤 24시간으로 낮춘다. 오래된 로그의 API 조회 차단과 청크 삭제를 각각 확인하며, 최신 로그가 남는지도 확인한다. TSDB head 회전과 삭제에는 최대 20분을 기다린다. 24시간 유입량과 운영 저장 공간·비용은 아직 측정하지 않았다.

collector의 파일 쓰기와 cursor 갱신 사이 중단은 중복 가능성이 있다. 원시 로그 회전 전에 못 읽으면 유실될 수 있다. 8MiB를 넘는 밀린 stdout 처리와 정확히 한 번 전달을 보장하지 않는다. Alloy 재시도/버퍼 한도 밖 장애도 유실될 수 있다.

## 종료·인수인계

종료는 각 시험 프로젝트의 `docker compose stop`이다. 볼륨은 재검토용으로 보존한다. `down -v`나 prune으로 다른 프로젝트를 지우지 않는다. cookie·메일 링크·DB dump는 무시된 validation-runtime/private에만 두고 첨부하지 않는다. 비밀 없는 결과는 `docs/validation/ops-1104/`에 둔다.

다른 팀원이 이 문서로 실행하고 실제 실패 지점과 시간을 남기기 전에는 인수인계 완료로 표시하지 않는다. 비용은 일별 증가 바이트×보관일수, 백업 크기, 실행시간과 실제 단가를 받아 계산한다. 10회 자원 표본은 24시간 기준선이나 운영 비용이 아니다.

설정 근거: [Loki retention](https://grafana.com/docs/loki/latest/operations/storage/retention/), [Alloy loki.process](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.process/).

정책 초안은 `design/OPS_보관삭제정책_초안.md`, 이슈별 완료 여부는 검증 기록을 따른다.
