# Deploying PasarEx LM

The app is a monorepo: a NestJS API + two Vite frontends (driver PWA, Ops console),
backed by PostgreSQL/PostGIS (and optionally Redis). Below: GitHub, then DigitalOcean
App Platform.

---

## 1. Push to GitHub

From the repo root (one-time):

```bash
gh auth login
gh repo create pasarex-lm --private --source=. --remote=origin --push
```

Already have a repo? `git remote add origin <url> && git push -u origin master`.

> `.env` is git-ignored — API keys never leave your machine. Set them as App
> Platform **secrets** instead (below).

---

## 2. DigitalOcean App Platform

The spec `.do/app.yaml` defines one app on one domain:

| Path | Component | What |
|------|-----------|------|
| `/` | `driver` (static) | Driver PWA + consignee tracking/rating |
| `/ops` | `ops` (static) | Ops console (built with `--base=/ops/`) |
| `/api`, `/socket.io` | `api` (Docker service) | NestJS API + WebSocket |
| — | `migrate` (PRE_DEPLOY job) | Runs TypeORM migrations before each release |
| — | `pasarex-db` | Managed PostgreSQL 16 |

### 2a. Create the app

1. Edit `.do/app.yaml` and replace **`REPLACE_WITH_GH_OWNER/pasarex-lm`** (4 places)
   with your actual GitHub repo.
2. Authorize DO's GitHub integration (DO dashboard → Apps → GitHub) so it can read
   the repo, then:

```bash
doctl apps create --spec .do/app.yaml
```

(or App Platform console → **Create App → Import from spec** and paste the file).

### 2b. Set the secrets

In the app's **Settings → App-Level / Component Env Vars**, replace the `CHANGE_ME…`
secret values:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — long random strings (e.g. `openssl rand -hex 32`).
- `EVOLUTION_WEBHOOK_TOKEN` — a random string; you'll reuse it when registering the webhook.
- Optional: `OPENROUTER_API_KEY` (OCR auto-fill), `EVOLUTION_API_KEY` + `EVOLUTION_INSTANCE`
  (WhatsApp). Leave blank to keep those features stubbed.

### 2c. Enable PostGIS

The `EnablePostgis` migration runs `CREATE EXTENSION postgis`. If the app DB user lacks
permission, enable it once from the DO console: **Databases → pasarex-db → Settings →
Extensions → add `postgis`** (and `uuid-ossp`), then re-deploy so `migrate` completes.

### 2d. Seed the first users (one-time)

Migrations create the schema but no data — you need at least the staff logins. Seeding
uses ts-node, so run it **locally against the production DB** once (⚠️ it TRUNCATEs, so
only before go-live):

```bash
# get the DB connection from DO → Databases → pasarex-db → Connection details
DB_HOST=... DB_PORT=... DB_USER=... DB_PASSWORD=... DB_NAME=... DB_SSL=true \
  npm run seed
```

This creates `admin@pasarex.com / pasarex123` (change the password after first login),
the Barbados parishes, workflow, and demo data.

### 2e. WhatsApp inbound (optional)

Now that the API has a public URL, point the Evolution instance's webhook at it:

```bash
curl -X POST https://<your-app-url>/api/whatsapp/webhook/register \
  -H "Authorization: Bearer <an-admin-JWT>" \
  -H "Content-Type: application/json" \
  -d '{"apiBaseUrl":"https://<your-app-url>"}'
```

---

## Notes & follow-ups

- **Redis is omitted** from this spec. The API boots fine without it, but the BullMQ
  schedulers (daily compliance scan, nightly score recompute) are disabled — the manual
  "Run scan" button in Ops still works. To enable them, add a DO Managed Caching (Valkey)
  database and set `REDIS_HOST`/`REDIS_PORT`; note `ioredis` will need TLS + password
  options added for a managed Redis (small follow-up in `env.ts` + the BullMQ configs).
- **`/ops` sub-path:** the Ops site is built with `--base=/ops/` so its assets resolve
  under that prefix. If assets 404 on first deploy, App Platform is stripping the prefix —
  either set the ops base back to `/` or move Ops to its own subdomain component.
- **Custom domain:** add it under the app's **Domains** tab; `CORS_ORIGINS` and
  `PUBLIC_BASE_URL` use `${APP_URL}` and update automatically.
- **First deploy is untested against a live DO account** (no token available here) — the
  spec is sound but may need a small tweak or two; the migrate job logs will show any DB
  connection/extension issue.
