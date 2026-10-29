"""pm2·컨테이너 진입점: `python -m model_api.main` → MODEL_API_HOST(기본 127.0.0.1):MODEL_API_PORT(기본 9541). 컨테이너는 0.0.0.0(SD_04 10-3)"""
import os

import uvicorn


def main() -> None:
    uvicorn.run("model_api.app:app", host=os.environ.get("MODEL_API_HOST", "127.0.0.1"), port=int(os.environ.get("MODEL_API_PORT", "9541")),
                workers=1, log_level="warning")


if __name__ == "__main__":
    main()
