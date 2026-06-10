# Sherpa LM — On-Demand Last-Mile Delivery Platform

An Uber-style last-mile delivery platform for **Bogotá, Colombia** (bilingual ES/EN). It
onboards and vets drivers & vehicles, runs a **configurable** approval + security-clearance
workflow, tracks document compliance with expiry reminders, broadcasts freight as priority-wave
tenders to an eligibility-ranked driver pool, tracks deliveries live by GPS, and feeds consignee
ratings back into a DriverScore that drives tender priority.

> Built in phases (see [`DECISIONS.md`](./DECISIONS.md) for choices). The whole platform boots
> end-to-end with **stub providers + seed data** — no paid accounts required.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + TypeScript, **NestJS**, **TypeORM** |
| Database | **PostgreSQL + PostGIS** (operating-area polygons, geo radius, GPS) |
| Cache / queues | Redis + BullMQ |
| Realtime | Socket.IO (live GPS + tender push) |
| Notifications | Pluggable provider interface — console stub (default), FCM, WhatsApp (Evolution API) |
| Admin web (Ops) | React + Vite (reuses the Sherpa design system CSS) |
| Driver app | React PWA |
| Shared | `@sherpa/shared` — types/enums/contracts |

## Monorepo layout

```
packages/shared      shared TS types & enums
apps/api             NestJS API + TypeORM + workers + WS gateway
apps/admin           Ops web console        (port 5273)
apps/driver          Driver PWA             (port 5274)
design-reference/    the original Claude Design prototype (visual source of truth)
```

## Prerequisites

- Node.js ≥ 20 (tested on 24)
- Docker (for Postgres+PostGIS + Redis)

## Run it

```bash
# 1. install
npm install

# 2. config — copy env (defaults work as-is; ports chosen to avoid common clashes)
cp .env.example .env        # already includes working dev values

# 3. infra (Postgres+PostGIS on :5436, Redis on :6379)
npm run infra:up

# 4. database
npm run migration:run       # enables PostGIS + creates schema
npm run seed                # config rows + demo drivers/vehicles/areas/freight

# 5. dev (api + both frontends)
npm run dev
```

- API → http://localhost:3100/api  (health: `/api/health`)
- Ops console → http://localhost:5273
- Driver PWA → http://localhost:5274

### Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@sherpa-c.com` | `sherpa123` |
| Dispatcher | `dispatch@sherpa-c.com` | `sherpa123` |
| Security officer | `security@sherpa-c.com` | `sherpa123` |

Seed drivers (`aurelio@drv.co` … `hector@drv.co`) share the same password.

## Ports (configurable via `.env`)

This dev machine already runs services on 3000 / 5432–5435 / 5173, so Sherpa LM defaults to
**API 3100, Postgres 5436, admin 5273, driver 5274** (Redis 6379). Change them in `.env`.

## Tests

```bash
npm test            # runs the API test suite (Jest)
```

Core-engine tests (tender eligibility, scoring, reminders) are added in the phases that build
those modules.

## Configuration over hardcoding

Document types, approval workflow/stages (incl. the mandatory security gate), scoring weights &
tiers, reminder offsets, and notification templates are **seeded database rows**, editable from
the admin console — never hardcoded. RBAC is enforced server-side on every endpoint.

## Build progress

1. ✅ **Scaffold + DB schema/migrations + auth/RBAC + seed**
2. ✅ **Onboarding wizard + configurable DocumentTypes + upload + OCR auto-fill**
3. ✅ **Approval workflow engine + security stage + Ops queue**
4. ✅ **Document expiry reminders + eligibility auto-suspend (BullMQ)**
5. ✅ **Shipment + tender engine + priority-wave broadcast (WS)**
6. ✅ **GPS streaming + live map + consignee tracking link** — *this phase*
7. ⬜ Ratings + DriverScore + tiering + priority batch
8. ⬜ Admin console for all config + polish/docs/tests
