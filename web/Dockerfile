FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ARG VITE_RELIEF_DEPTH=0
RUN VITE_WORLD_SERVER=1 VITE_RELIEF_DEPTH=$VITE_RELIEF_DEPTH npm run build:world

FROM nginx:1.28.0-alpine@sha256:30f1c0d78e0ad60901648be663a710bdadf19e4c10ac6782c235200619158284 AS runtime
COPY --from=build /app/web/dist-world/ /usr/share/nginx/html/
COPY ops/docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
