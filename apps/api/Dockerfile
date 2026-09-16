# PasarEx LM API — multi-stage build for the npm-workspaces monorepo.
# Build context MUST be the repo root (so packages/shared is available):
#   docker build -f apps/api/Dockerfile -t pasarex-api .

# ---- build stage: install all deps, compile shared + api ----
FROM node:22-slim AS build
WORKDIR /repo

# copy manifests first for a cached install layer (all workspaces are needed
# for the workspace-aware `npm ci` to resolve links)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/driver/package.json apps/driver/
RUN npm ci

# copy sources needed to build the API
COPY tsconfig*.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# build shared (emits dist consumed by the API) then the API
RUN npm run build -w @sherpa/shared \
 && npm run build -w @sherpa/api

# ---- runtime stage: prod deps + compiled output ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/driver/package.json apps/driver/
# prod dependencies only (typeorm is a prod dep, so migrations work at runtime)
RUN npm ci --omit=dev

# compiled output
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist

WORKDIR /repo/apps/api
EXPOSE 3100
CMD ["node", "dist/main.js"]
