/**
 * Dockerfile de referência para split futuro Cloud Run md-seal-worker / md-voice-worker.
 * No MVP os workers rodam em App Hosting (/api/workers/*).
 *
 * Build (futuro):
 *   docker build -f workers/Dockerfile --build-arg WORKER=seal -t md-seal-worker .
 */
ARG WORKER=seal
FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080
EXPOSE 8080
# Placeholder: use Next standalone ou um server.ts por worker quando separar.
CMD ["node", "-e", "console.log('Use App Hosting /api/workers in MVP. Split Cloud Run later.')"]
