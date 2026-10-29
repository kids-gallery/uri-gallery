# web: 화면 빌드 → nginx(SD_04 10-1). 빌드 맥락은 저장소 맨 위: docker build -f web/Dockerfile .
FROM node:22-bookworm AS build
WORKDIR /src/web
# 의존성 먼저(소스만 바뀌면 이 층을 다시 쓴다)
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM nginx:1.30.6-alpine
COPY ops/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
