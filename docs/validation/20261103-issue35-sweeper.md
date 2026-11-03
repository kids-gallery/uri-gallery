# #35 sweeper 컨테이너 종료·이어받기 확인

## 환경과 범위

2026-11-03, Windows Docker Desktop / WSL Ubuntu, Linux amd64. #77 + #84, 가짜 모델. 원래 사용자의 DB를 건드리지 않도록 전용 compose 프로젝트와 새 볼륨을 만들고 시험 뒤 정리했다. 격리 포트 19501·18025, 임시 파일 기반 secrets 사용. sweeper는 app-api와 같은 이미지, `init: true`, 같은 작품 볼륨과 `node dist/src/sweeper/main.js`를 사용했다.

## 결과

- `cd api && npx vitest run tests/deletion-sweeper.test.ts`: 11개 통과. 삭제·실패 재시도와 점유 만료 복구를 포함한다.
- 대기 중 `docker compose stop sweeper`: 375ms, 종료 코드 **143**(SIGTERM). 종료 코드 0의 정상 종료로 표현하지 않는다.
- 합성 그림의 삭제 요청을 만든 후 DB 트랜잭션으로 해당 `deletion_request` 행을 잠그고 sweeper를 시작했다. `information_schema.INNODB_LOCK_WAITS`가 1인 상태에서 stop: 372ms, 종료 코드 143. 잠금을 해제하고 다시 start한 뒤 삭제 요청 `completed`를 확인했다.
- 이 검증은 DB 잠금 대기 중 중단 한 지점의 이어받기다. 파일 삭제 중 프로세스가 끊긴 경우와 모든 종료 시점의 원자성은 보장하지 않는다. 종료 코드는 신호 종료이므로 진행 중 작업을 스스로 마무리한 후 종료했다는 뜻도 아니다. 넓은 시나리오는 #41에서 확인한다.

## 재현에 쓰인 핵심 명령

```bash
docker compose -p <시험프로젝트> stop sweeper
docker inspect -f '{{.State.ExitCode}}' <sweeper-컨테이너>
docker compose -p <시험프로젝트> start sweeper
```

시간은 stop 전후 `date +%s%N` 차이로 계산했다. 작업 중 시험은 삭제 요청 행에 `SELECT ... FOR UPDATE` 잠금을 잡고 별도 연결의 `information_schema.INNODB_LOCK_WAITS`를 확인했다. 삭제 요청은 재시작 뒤 DB에서 상태를 조회했다.
