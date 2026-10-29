# syntax=docker/dockerfile:1
# model-api · worker · seed · fetch-models가 함께 쓰는 이미지(SD_04 10-1·10-4). 빌드 맥락은 저장소 맨 위: docker build -f serving/Dockerfile .
FROM python:3.11-slim
ARG TARGETARCH
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    MODEL_ROOT=/models MODEL_MANIFEST=/app/models/manifest.yaml CONTRACTS_DIR=/app/contracts \
    STORAGE_ROOT=/srv/uam/store UAM_RUN_DIR=/srv/uam/run HF_HUB_OFFLINE=1
WORKDIR /app/serving
# 모델 묶음 잠금은 CPU 종류로 고른다: x86_64는 PyTorch CPU판, arm64는 맥과 같은 잠금(serving/README.md)
COPY serving/requirements-models.lock serving/requirements-models-linux-x86_64.lock ./
# 받은 파일은 빌드 캐시에 남겨 재시도 때 다시 받지 않는다(이미지에는 들어가지 않음)
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$TARGETARCH" = "amd64" ]; then L=requirements-models-linux-x86_64.lock; else L=requirements-models.lock; fi \
  && pip install --retries 10 --timeout 120 --require-hashes -r "$L"
COPY serving/ ./
COPY models/manifest.yaml /app/models/manifest.yaml
COPY contracts/ /app/contracts/
# uid 1000: api 이미지의 node 사용자와 같은 번호(작품 파일 볼륨을 함께 쓴다)
RUN useradd -u 1000 -m uam && mkdir -p /srv/uam/store /srv/uam/run /models && chown -R uam:uam /srv/uam
USER uam
EXPOSE 9541
CMD ["python", "-m", "model_api.main"]
