# 로컬 비밀 값 준비

`*.example`은 값이 없는 이름 안내이며 그대로 실행용으로 쓰지 않는다.
실제 파일 이름은 `db_password`, `session_secret`, `auth_hmac_secret`이다.
각 값은 로컬 터미널에서 `openssl rand -hex 32`로 서로 다르게 생성한다.
생성한 값은 로컬에서만 보관하며 커밋·PR·스크린샷에 넣지 않는다.
실제 비밀 파일과 `.env`는 Git에서 제외된다. 파일 권한은 소유자만 읽도록 제한한다.

compose(#32)는 각 파일을 같은 이름의 secret으로 선언하고 필요한 서비스에만 붙인다.
API와 serving에는 `DB_PASSWORD_FILE=/run/secrets/db_password`, API에는
`SESSION_SECRET_FILE=/run/secrets/session_secret`, `AUTH_HMAC_SECRET_FILE=/run/secrets/auth_hmac_secret`을 전달한다.
DB에는 `MARIADB_PASSWORD_FILE`과 개발용 `MARIADB_ROOT_PASSWORD_FILE`을 `/run/secrets/db_password`로 지정한다(#18).
API 파일 읽기는 #21, serving 파일 읽기는 #23에서 구현한다.

`.env.example`은 컨테이너 망 주소를 사용한다. 호스트 개발 서버에는 DB 주소를
`127.0.0.1:<게시한 DB 포트>`, SMTP를 `smtp://127.0.0.1:<게시한 SMTP 포트>`로 직접 넘긴다.
API와 마이그레이션은 `.env`를 자동으로 읽지 않는다. HTTP에서만 `SECURE_COOKIES=false`를 쓴다.
