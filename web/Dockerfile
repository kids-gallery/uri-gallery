FROM node:22.23.4-bookworm-slim AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ARG VITE_RELIEF_DEPTH=0
ARG VITE_TRIAL=0
RUN VITE_WORLD_SERVER=1 VITE_RELIEF_DEPTH=$VITE_RELIEF_DEPTH VITE_TRIAL=$VITE_TRIAL npm run build:world

FROM nginx:1.28.0-alpine AS runtime
COPY --from=build /app/web/dist-world/ /usr/share/nginx/html/
COPY ops/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
