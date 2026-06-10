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

## Phase 2
- **OCR auto-fill via OpenRouter** (user-requested). Uploaded documents are sent to an OpenRouter
  vision model (`OPENROUTER_MODEL`, default `google/gemini-2.0-flash-001`) which returns structured
  fields (name, cédula, plate, brand, year, expiry dates…). The applicant uploads license/SOAT/
  registration and the form pre-fills, minimizing typing. **Graceful degradation:** with no
  `OPENROUTER_API_KEY` (or a non-image/PDF upload) OCR is skipped and manual entry still works — the
  platform keeps its "boots with no paid account" guarantee. The OCR service never throws.
- **Anonymous onboarding via resume token.** Drivers have no account until they submit, so an
  Application carries a random `resumeToken`; the public onboarding endpoints (`@Public`) are guarded
  by that token instead of a JWT. The driver User + DriverProfile + Vehicle + Documents are created
  atomically at submit, gated `securityCleared=false / eligible=false` until the workflow passes.
- **Uploads live in the draft until submit.** The `Document` entity requires a driver FK that doesn't
  exist pre-submit, so uploaded file refs + OCR results are kept in `Application.draft.documents`;
  real `Document` rows are created on submit. Avoids an extra nullable-owner schema.
- **OCR only fills empty fields** — it never clobbers a value the applicant already typed; expiry/
  issue dates are recorded per document.
- Local-disk storage behind a `StorageService` interface (S3-swappable); files under `./storage`.

## Phase 3
- **Workflow engine reads config, never hardcodes the pipeline.** `WorkflowService` loads the
  active `ApprovalWorkflow`'s ordered stages and walks them: **automatic** stages evaluate a JSON
  `ruleset` against submitted data (e.g. `requireAllRequiredDocs` auto-approves uploaded docs),
  **manual** stages park the application in the responsible role's queue. Reordering/adding stages
  in config changes behavior with no code change.
- **Security stage gates eligibility.** Passing the stage flagged `isSecurityClearance` sets
  `driver.securityCleared=true`; only then can `computeEligibility` make the driver tender-eligible.
- **Stage-role enforcement.** `decide()` rejects (403) anyone whose role ≠ the current stage's
  `responsibleRole` (admin overrides). Verified: dispatcher gets 403 trying to clear a security stage.
- **`computeEligibility` is a pure, unit-tested function** (security cleared + all required docs
  approved & unexpired) — reused later by the compliance auto-suspend job (Phase 4).
- Every decision writes an `AuditLog` (actor, stage, outcome, reason); approval/rejection notifies
  the driver through the templated NotificationsService. Seed demo applications have no DriverProfile
  (pure queue demos), so all driver mutations are null-guarded.
