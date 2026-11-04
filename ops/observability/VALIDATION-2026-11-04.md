# 운영 작업 착수·검증 기록

이 파일은 Docker 엔진 연결 전의 초기 기록이다. Docker 기동 뒤의 최신 결과와 남은 일은 `RESULTS-2026-11-04.md` 및 `docs/validation/ops-1104/README.md`를 따른다.

관련: #103~#113. 2026-11-04부터 진행. 공개 운영 적용은 수행하지 않았다.

## 이번 변경 (#103, #108)

- `normalize.mjs`: Node 숫자 수준과 Python 문자열 수준을 통일한다. DEBUG는 버리고 미지 수준은 unknown으로 남긴다. ISO timestamp, service, environment, event, durationMs, httpStatus만 출력한다. event는 고정값이다. 자유 문장, 예외, 이메일, 토큰, 경로, 별칭과 추적 ID는 전달하지 않는다. HTTP 503도 원래 로그 수준과 별도 보관한다.
- 기존 앱·Python 원시 로거는 변경하지 않았다. 원시 로그 개인정보 점검과 안전한 requestId/job_id 추적은 남았다. 아직 Alloy에 이 변환기를 연결하지 않았으며 원문을 fixtures에 넣으면 정제되지 않는다.
- `isolation.mjs`: 두 resolved Compose JSON의 프로젝트, 명시적 볼륨·네트워크 이름, 비밀 파일, 쓰기 bind mount 공유를 거부한다. 시험 포트는 loopback만 허용한다. DB의 외부 연결 주소, 경로 alias/symlink와 실제 실행 대상까지 검증하지는 못한다.

## 검증

Windows, Node 내장 test runner:

```powershell
node --test ops/observability/normalize.test.mjs ops/observability/isolation.test.mjs
```

6개 통과. 수준 정규화, 합성 개인정보 제거, 시간·소요 시간·5xx 구분, 같은 논리 키의 격리 허용, 물리 자원 공유 거부, 전체 인터페이스 포트 거부. `git diff --check` 통과.

Docker Desktop 실행을 시도했으나 Linux 엔진 named pipe를 찾지 못했다. 실제 컨테이너 기동·Alloy/Loki 전달·DB 장애/복원은 이번 기록에서 미검증이다.

## 이어서 할 일

1. #103 원시 로거와 제삼자 출력 fixture 점검, 추적 ID 계약 확정.
2. #104 정제 출력만 Alloy에 연결하고 수준/5xx/서비스 필터, 수집 heartbeat 검증.
3. #105 로그 회전·보관 삭제와 Loki 중단/재기동 표본 시험.
4. #108 DB 접속 대상과 실행 볼륨 비교 확대, 시험 프로젝트 기동.
5. #109 A/B 가족 권한 회귀, #110 합성 접수의 워커 중단/재개.
6. #113 보관/삭제 정책 초안, #107 일관된 백업·격리 복원.
7. #106 큐·수집 중단 경보, #111 버전 기록과 되돌리기, #112 자원 측정과 인수인계.

보관 기간·RPO/RTO·알림 채널·예산은 결정값으로 꾸미지 않는다. 팀 결정과 실제 수신, 다른 팀원의 복구 시험이 필요한 완료 조건은 열린 상태로 유지한다.
