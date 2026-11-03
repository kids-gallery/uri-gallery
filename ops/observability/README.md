# 로그판 시험 환경

이 구성은 합성 JSON 로그만 수집하는 실험용이다. 실제 서비스 로그·가족 데이터를 연결하지 않는다. Loki 인증·보관 삭제·수집 장애 경보가 없어 운영 배포에 사용하지 않는다.

PowerShell에서 `GRAFANA_TEST_PASSWORD`를 일회용 값으로 설정한 뒤 이 디렉터리에서 `docker compose up -d`를 실행한다. `fixtures`에 level이 info, warn, error인 JSON 한 줄을 추가하면 Grafana `http://127.0.0.1:13000`의 시험 로그판에서 확인한다. Grafana/Loki/Alloy 상태는 볼륨에 남는다. 기본 계정 암호는 기존 Grafana 볼륨이 있으면 환경 변수 변경만으로 갱신되지 않는다.

중지: `docker compose stop`. 볼륨 삭제는 데이터를 지우므로 시험 종료 후 대상 확인과 별도 판단이 필요하다. 본 구성은 로그 보관 기간·디스크 상한·실제 로그 정제·접근 통제·알림 검증을 완료하지 않는다.
