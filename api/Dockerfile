FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm ci
EXPOSE 9521
CMD ["node", "dist/src/server.js"]
