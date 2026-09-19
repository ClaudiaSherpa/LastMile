# PasarEx LM edge — builds both SPAs and serves them via nginx (+ API proxy).
# Build context MUST be the repo root.
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/driver/package.json apps/driver/
RUN npm ci
COPY tsconfig*.json ./
COPY packages/shared packages/shared
COPY apps/driver apps/driver
COPY apps/admin apps/admin
# driver at site root; ops built with base=/ops/ so its assets resolve under /ops
RUN npm run build -w @sherpa/shared \
 && npm run build -w @sherpa/driver \
 && npm run build -w @sherpa/admin -- --base=/ops/

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/driver/dist /usr/share/nginx/html
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html/ops
EXPOSE 80
