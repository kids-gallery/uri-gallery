FROM python:3.11.18-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/serving
COPY serving/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY serving/ ./
COPY contracts/model-api.openapi.yaml /app/contracts/model-api.openapi.yaml
COPY models/manifest.yaml /app/models/manifest.yaml
ENV MODEL_MANIFEST=/app/models/manifest.yaml \
    MODEL_ROOT=/models STORAGE_ROOT=/data/store UAM_RUN_DIR=/data/run
RUN groupadd --gid 1000 uam && useradd --uid 1000 --gid 1000 --create-home uam \
    && mkdir -p /data/store /data/run && chown -R 1000:1000 /data
USER 1000:1000
EXPOSE 9541
CMD ["python", "-m", "model_api.main"]
