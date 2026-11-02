# 앱 API 이미지(마스터플랜 3-2·3-5 2번, #22). app-api·sweeper·db-migrate가 같은 이미지를 쓰고 명령만 다르다.
#   app-api   node dist/src/server.js   (기본 명령)
#   sweeper   node dist/src/sweeper/main.js
#   db-migrate node dist/scripts/migrate.js
# 빌드는 저장소 맨 위에서: docker build -f api/Dockerfile -t uam-api .
# sharp·argon2가 glibc용 미리 빌드한 파일을 쓰므로 slim(Debian) 기반이다.
FROM node:22.22.0-bookworm-slim AS build
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/tsconfig.json ./
COPY api/src ./src
COPY api/scripts ./scripts
RUN npm run build

FROM node:22.22.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/api/dist ./dist
COPY db/migrations /app/db/migrations
COPY contracts /app/contracts
COPY models/manifest.yaml /app/models/manifest.yaml
ENV CONTRACTS_DIR=/app/contracts MODEL_MANIFEST=/app/models/manifest.yaml MIGRATIONS_DIR=/app/db/migrations
USER node
EXPOSE 9521
CMD ["node", "dist/src/server.js"]
