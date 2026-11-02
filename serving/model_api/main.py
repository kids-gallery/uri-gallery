"""pm2 진입점: `python -m model_api.main` → 127.0.0.1:9541"""
import os

import uvicorn

from common.config import load_settings


def main() -> None:
    load_settings()  # 비밀 파일 오류는 요청의 500이 아니라 기동 실패로 처리한다.
    uvicorn.run("model_api.app:app", host=os.environ.get("MODEL_API_HOST") or "127.0.0.1", port=int(os.environ.get("MODEL_API_PORT", "9541")),
                workers=1, log_level="warning")


if __name__ == "__main__":
    main()
