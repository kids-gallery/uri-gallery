"""model-api(:8100) — 내부 경로(/internal, T109)와 외부 모델 기능 경로(/v1/models/*, UC12, T121·T122·T130)를 조립한다."""
from fastapi import FastAPI

from .external import router as external_router
from .internal import router as internal_router

app = FastAPI(title="uam model-api", docs_url=None, redoc_url=None)
app.include_router(internal_router)
app.include_router(external_router)
