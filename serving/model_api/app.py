"""model-api(:8100) — 이 파일은 내부 경로만 조립한다. 외부 `/v1/models/*`(UC12)는 T118 이후 붙인다."""
from fastapi import FastAPI

from .internal import router as internal_router

app = FastAPI(title="uam model-api", docs_url=None, redoc_url=None)
app.include_router(internal_router)
