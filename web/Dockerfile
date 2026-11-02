FROM node:22.23.4-bookworm-slim AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN VITE_WORLD_SERVER=1 npm run build:world

FROM nginx:1.28.0-alpine AS runtime
COPY --from=build /app/web/dist-world/ /usr/share/nginx/html/
COPY ops/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
