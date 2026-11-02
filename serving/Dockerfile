FROM python:3.11.18-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/serving
ARG TARGETARCH
ARG INSTALL_MODELS=0
ARG MODEL_LOCK=""
COPY serving/requirements*.lock ./
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) expected=requirements-models-linux-x86_64.lock ;; \
      arm64) expected=requirements-models.lock ;; \
      *) echo "Unsupported CPU architecture: $TARGETARCH (supported: amd64, arm64)" >&2; exit 1 ;; \
    esac; \
    case "$INSTALL_MODELS" in \
      0) test -z "$MODEL_LOCK" || { echo "MODEL_LOCK requires INSTALL_MODELS=1" >&2; exit 1; }; lock=requirements.lock ;; \
      1) lock="${MODEL_LOCK:-$expected}"; test "$lock" = "$expected" || { echo "MODEL_LOCK must be $expected for $TARGETARCH" >&2; exit 1; } ;; \
      *) echo "INSTALL_MODELS must be 0 or 1" >&2; exit 1 ;; \
    esac; \
    pip install --no-cache-dir --require-hashes -r "$lock"
COPY serving/ ./
COPY contracts/model-api.openapi.yaml /app/contracts/model-api.openapi.yaml
COPY models/manifest.yaml /app/models/manifest.yaml
ENV MODEL_MANIFEST=/app/models/manifest.yaml \
    MODEL_ROOT=/models STORAGE_ROOT=/data/store UAM_RUN_DIR=/data/run
EXPOSE 9541
CMD ["python", "-m", "model_api.main"]
