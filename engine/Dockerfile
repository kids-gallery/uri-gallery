# 움직임 엔진(M3 Animated Drawings, TorchServe) — 배포 묶음 전용(SD_04 10-1·10-8).
# 원본: facebookresearch/AnimatedDrawings torchserve/Dockerfile(커밋 b859684, 저장소는 2025-09 보관 처리됨).
# x86_64 전용(mmcv-full 1.7.0 빌드). 이미지가 매우 크고(9/23 실측 약 33GB, 빌드 36분) 팀원이 각자 빌드하지 않도록
# 레지스트리에서 받는 방식을 제안한다(팀 결정). 맥 Apple Silicon에서는 에뮬레이션이라 개발에 쓰지 않는다(engine-dev 사용).
FROM --platform=linux/amd64 continuumio/miniconda3:24.1.2-0

RUN mkdir -p /usr/share/man/man1 \
 && apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y ca-certificates curl default-jre git gcc build-essential wget \
 && rm -rf /var/lib/apt/lists/*
RUN conda install python=3.8.13 -y
RUN pip install openmim==0.3.9 \
 && pip install torch==2.0.0 \
 && mim install mmcv-full==1.7.0 \
 && pip install mmdet==2.27.0 torchserve==0.12.0
# mmpose 의존성 xtcocoapi 버그 수정판(원본 Dockerfile과 같은 절차)
RUN git clone https://github.com/jin-s13/xtcocoapi.git /tmp/xtcocoapi \
 && cd /tmp/xtcocoapi && pip install -r requirements.txt && python setup.py install && rm -rf /tmp/xtcocoapi
RUN pip install mmpose==0.29.0 torchvision==0.15.1 numpy==1.24.4

RUN mkdir -p /home/torchserve/model-store \
 && wget -q https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_detector.mar -P /home/torchserve/model-store/ \
 && wget -q https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_pose_estimator.mar -P /home/torchserve/model-store/
COPY engine/config.properties /home/torchserve/config.properties
EXPOSE 9561
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=5 CMD curl -fsS http://127.0.0.1:9561/ping || exit 1
CMD ["/opt/conda/bin/torchserve", "--start", "--foreground", "--disable-token-auth", "--ncs", "--ts-config", "/home/torchserve/config.properties"]
