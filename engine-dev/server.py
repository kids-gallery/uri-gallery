"""개발용 가짜 엔진(SD_04 10-1) — TorchServe와 같은 경로에 답하지만 추론하지 않는다.

- GET  /ping                                      → {"status": "Healthy", "engine": "dev-fake"}
- POST /predictions/drawn_humanoid_detector       → []  (사람 검출 0건. 워커는 "사람 그림 아님"으로 처리한다)
- POST /predictions/<그 밖>                        → 501 (가짜 엔진은 그 밖의 추론을 하지 않는다)
모든 응답 머리에 X-Engine: dev-fake. 움직이는 그림 결과를 만들지 않으므로 가짜 성공이 생기지 않는다.
시연과 검증은 실제 엔진(compose.prod.yaml)으로 한다.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body) -> None:
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Engine", "dev-fake")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/ping":
            return self._send(200, {"status": "Healthy", "engine": "dev-fake"})
        return self._send(404, {"code": "not_found", "engine": "dev-fake"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n:
            self.rfile.read(n)  # 사진은 읽고 버린다(저장하지 않음)
        if self.path == "/predictions/drawn_humanoid_detector":
            return self._send(200, [])
        return self._send(501, {"code": "dev_fake_engine", "message": "개발용 가짜 엔진은 이 추론을 하지 않는다", "engine": "dev-fake"})

    def log_message(self, *_):  # 접속 기록을 남기지 않는다
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 9561), Handler).serve_forever()
