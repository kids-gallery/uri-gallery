# app-api · sweeper · migrate가 함께 쓰는 이미지(SD_04 10-1). 빌드 맥락은 저장소 맨 위: docker build -f api/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    MIGRATIONS_DIR=/app/db/migrations \
    CONTRACTS_DIR=/app/contracts \
    MODEL_MANIFEST=/app/models/manifest.yaml \
    STORAGE_ROOT=/srv/uam/store
WORKDIR /app/api
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
COPY api/package.json ./
# 실행 중에 읽는 파일(SD_04 10-4)
COPY contracts/ /app/contracts/
COPY db/migrations/ /app/db/migrations/
COPY models/manifest.yaml /app/models/manifest.yaml
# 작품 파일 볼륨의 주인은 uid 1000(serving 이미지와 같은 번호, 두 이미지가 같은 파일을 쓴다)
RUN mkdir -p /srv/uam/store && chown -R node:node /srv/uam
USER node
EXPOSE 9521
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD node -e "fetch('http://127.0.0.1:9521/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/src/server.js"]
