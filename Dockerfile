# syntax=docker/dockerfile:1

# One image, one origin: the NestJS API serves the built React app.
# glibc (Debian) base so argon2's prebuilt binary is used, no compiler needed.
ARG NODE_IMAGE=node:24-bookworm-slim

# ---- Backend: install, build, then drop dev dependencies -------------------
FROM ${NODE_IMAGE} AS backend-build
WORKDIR /app/backend
# The test-only Mongo binary is not needed to build.
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ---- Frontend: static build -------------------------------------------------
FROM ${NODE_IMAGE} AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Runtime ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# Same layout as the repo, so the backend finds ../frontend/dist.
COPY --from=backend-build /app/backend/package.json ./backend/package.json
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Baked in so /api/health/live reports exactly which commit is serving.
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}

USER node
WORKDIR /app/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
