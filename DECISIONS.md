# Decisions & Assumptions — Sherpa LM

Running log of notable choices made while building, per the brief's instruction to
"surface assumptions here rather than pausing." Newest at the bottom of each phase.

## Stack & repo
- **Monorepo:** npm workspaces (`packages/*`, `apps/*`). Chosen for zero extra tooling on
  Windows + Node 24; Turborepo deferred until build times justify it.
- **ORM: TypeORM** (not Prisma). Native `geometry` column support and raw `ST_*` spatial
  queries make PostGIS (operating-area polygons, radius, GPS) first-class. Prisma would need
  `Unsupported()` types + raw SQL for every geo op.
- **Frontends keep the prototype's hand-written `styles.css`** (oklch design tokens) instead of
  porting to Tailwind. The Claude Design bundle is the source of visual truth; reusing its CSS
  guarantees pixel parity and is faster than re-deriving tokens in a Tailwind config.
- **Migrations, not `synchronize`.** `synchronize: true` is never used (even in dev) so the
  schema is reproducible and the PostGIS extension/geometry columns are created deterministically.

## Conventions
- All config-over-hardcoding surfaces (DocumentType, ApprovalWorkflow/Stage, scoring weights &
  tiers, reminder offsets, notification templates) are **database rows seeded at install**, editable
  via the admin console — never hardcoded constants.
- Bilingual ES/EN everywhere: user-facing copy lives in `NotificationTemplate` rows and frontend
  i18n; entity display names carry `nameEs`/`nameEn`.
- Notifications go through a single `NotificationProvider` interface; default adapters are
  **console stubs** so the platform boots with zero external/paid services. FCM + WhatsApp
  (Evolution API) adapters are env-gated.
- RBAC enforced server-side on every route via a global guard + `@Roles()` decorator. Consignee is
  link/OTP-based with no account.

## Phase 1
- **Ports moved to avoid host clashes.** This dev machine already runs Postgres on
  5432–5435, a Next.js app on 3000, and Vite on 5173. Sherpa LM therefore defaults to:
  API `3100`, Postgres `5436`, admin `5273`, driver `5274` (Redis `6379` was free). All are
  env-driven, so a clean machine can revert to conventional ports.
- PostGIS geometries stored as `geometry(...,4326)` (WGS84 lon/lat). Bogotá seed polygons are
  approximate neighborhood boxes — good enough for `ST_Contains` eligibility demos, swappable for
  real cadastral polygons later.
- Driver demo coordinates map the prototype's abstract 0–100 zone grid onto real Bogotá lon/lat so
  the live map shows believable positions.
