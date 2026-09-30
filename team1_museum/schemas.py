"""schemas.py — 1팀 계약. 무엇을 받고(요청) 무엇을 돌려주는지(응답). 여기 없는 필드는 밖으로 나가지 않는다.

모르는 필드는 전부 거절한다(extra="forbid") — 필드명 오타까지 422로 막는다(해설 10쪽, 2·4팀 방식).
입력은 그림 사진 한 장뿐이다. 아이 이름·나이 같은 개인정보 칸은 없다.
"""
import base64
import binascii
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from settings import settings

LABELS = ("사람 그림", "동물 그림", "집 그림", "사물 그림")
MAGIC = (b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff")


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_base64: str = Field(..., min_length=16, max_length=28_000_000,
                              description="그림 사진 한 장(PNG·JPEG)을 base64로. 20MB 이하. data: 머리 없이",
                              examples=["iVBORw0KGgo..."])

    @field_validator("image_base64")
    @classmethod
    def png_or_jpeg(cls, v: str) -> str:
        v = v.strip()
        try:
            raw = base64.b64decode(v, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("base64가 아닙니다 — 이미지 파일을 base64로 인코딩해 보내 주세요")
        if len(raw) > settings.max_image_bytes:
            raise ValueError(f"이미지가 {settings.max_image_bytes // (1024 * 1024)}MB를 넘습니다 — 줄여서 보내 주세요")
        if not raw.startswith(MAGIC):
            raise ValueError("PNG·JPEG 이미지만 받습니다")
        return v


class PredictResponse(BaseModel):
    label: Literal["사람 그림", "동물 그림", "집 그림", "사물 그림", "판단보류"] = Field(
        ..., description="판단보류 = 네 종류 중 어느 것도 TAU 이상으로 확신하지 못함. 오류가 아니다 — 사람이 본다")
    warnings: list[str] = Field(..., description="판단보류 사유 등. 점수는 싣지 않는다")
    model_version: str


class BatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PredictRequest] = Field(..., min_length=1, max_length=32)


class BatchResponse(BaseModel):
    results: list[PredictResponse]
    count: int


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["ok", "loading", "error"]
    model_name: str
    model_version: str
    load_seconds: float | None = None
