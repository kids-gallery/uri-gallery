"""settings.py — 1팀 우리 아이 미술관 · 그림 종류 판정(M2)의 설정 (MS5 방식).

값은 «환경변수 → .env → 아래 기본값» 순서로 정해진다. 코드를 고치지 않고 .env 로 바꾼다.
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

HERE = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore", protected_namespaces=())

    model_name: str = "그림 종류 판정"
    model_version: str = "M2-1a25a44-u4"                   # 서비스의 M2 활성 버전 라벨과 같다(models/manifest.yaml · /internal/ready)
    model_description: str = ("아이가 그린 그림 사진 한 장(PNG·JPEG, base64)을 받아 무엇을 그렸는지 "
                              "사람 그림·동물 그림·집 그림·사물 그림 중 하나로 답한다. 확신이 낮으면 판단보류. "
                              "점수는 돌려주지 않는다(BR-SUG-02).")
    model_dir: str = "model"                               # 가중치 지문(weights.json)·프롬프트(m2_prompts.yaml)
    hf_cache: str = str(HERE.parents[1] / "models" / "hf")  # 가중치 파일은 우리 서빙이 받아 둔 캐시를 오프라인으로 읽는다(저장소 루트 = ops/의 위)
    # TAU — 네 종류 중 가장 높은 확률이 이 값보다 낮으면 판단보류. 근거: 네 갈래 균등 확률이 0.25라서
    # «절반 이상 확신할 때만 답한다»는 보수적 값 0.5 [추론]. 평가 묶음 1차 측정(T137, U5) 뒤 측정값으로 바꾼다.
    tau: float = 0.5
    min_side_px: int = 64                                  # 이보다 작은 이미지는 판단하지 않는다(422) — 경계값
    max_image_bytes: int = 20 * 1024 * 1024                # 서비스와 같은 한 장 상한(BR-INT-01)
    log_level: str = "INFO"
    max_batch_size: int = 32
    port: int = 8000                                       # bench.py(공용) 가 127.0.0.1:8000 을 잰다


settings = Settings()
