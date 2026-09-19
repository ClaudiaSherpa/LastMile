# Decisions & Assumptions — PasarEx LM

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
  5432–5435, a Next.js app on 3000, and Vite on 5173. PasarEx LM therefore defaults to:
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

## Phase 4
- **BullMQ repeatable daily scan** (`0 8 * * *`) runs the compliance check; a `ComplianceScheduler`
  owns the Queue + in-process Worker. If Redis is down it logs a warning and the API still boots —
  scheduled scans just disabled. An admin trigger runs the scan **synchronously** (returns a summary)
  for instant demo feedback; a separate endpoint exercises the queued path.
- **Reminder cadence is config-driven** per `DocumentType.reminderOffsets` (default 30/15/3). The
  decision of which offset fires is a pure, unit-tested `reminderDue()` — on a late first scan it
  fires only the most urgent crossed threshold and marks earlier ones handled (no spam). Sent
  reminders are recorded as `Reminder` rows to dedupe.
- **Auto-suspend / restore reuses `computeEligibility`** (shared with the approval engine). When a
  required doc expires the driver is set `eligible=false` (+audit `eligibility.suspended`, notify
  driver + all dispatchers); renewing the doc re-approves it, clears sent reminders, and restores
  eligibility if all required docs are valid (audit `eligibility.restored`). Verified end-to-end.
- Seed adds tracked docs with near/past expiries (Marisol reminder, Camila lapse) so the compliance
  dashboard and auto-suspend are demoable immediately. Ops gets a Compliance tab (scan + renew).

## Phase 5
- **Eligible-pool computation is a pure, unit-tested module** (`tenders/pool.ts`): a driver qualifies
  only if security-cleared, eligible (not suspended), available (on-duty, not delivering/off-duty),
  vehicle type matches, capacity ≥ weight, and they cover the pickup **or** drop zone. Ranked by
  DriverScore desc. 12 pool tests.
- **Zone matching uses driver↔operating-area membership** rather than live `ST_Contains`. Freight
  carries PostGIS points (from zone centroids) for the map, but eligibility keys off the seeded zone
  coverage — simpler, deterministic, and equivalent for the demo. `ST_Contains` remains available for
  point-based freight later.
- **Priority waves by tier:** Elite/Preferred get wave 0, Standard wave 1, New wave 2; **priority
  freight is Elite-exclusive** in wave 0. The offer widens one wave per `TENDER_WAVE_MS` (default 15s).
- **Wave advancement uses in-process `setTimeout`**, not BullMQ — a single API instance, and a tender
  surviving a restart simply stays at its current wave (acceptable for MVP). BullMQ stays reserved for
  the durable daily compliance job.
- **First-accept-wins is atomic:** `UPDATE tender SET open=false WHERE id=? AND open=true` — a second
  accept gets 409. Verified end-to-end (Aurelio wins, second accept 409, freight assigned, delivery
  opened with a tracking token).
- **Tender accept/decline are `@Public` with driverId in the body** because the MVP driver PWA is
  link/device-based (no JWT yet); the engine still validates pool membership + wave. Real driver auth
  is a later hardening step.
- Realtime is a Socket.IO hub (rooms `ops`, `driver:<id>`, `delivery:<id>`); REST stays the source of
  truth + RBAC, the socket is a push channel. Ops Freight screen creates/broadcasts freight and shows
  a live tender feed; Vite proxies `/socket.io` (ws) to the API.

## Phase 6
- **Server-side GPS simulator** (`TrackingSimulator`, `TRACKING_SIMULATE=on`) moves active-delivery
  drivers toward their dropoff and jitters idle drivers, emitting `driver.location` every 2.5s — so the
  live map and consignee page move with **no real device**. Real device pings hit the same
  `POST /tracking/ping` path; set `TRACKING_SIMULATE=off` to rely on them. Pings persist as
  `LocationPing` rows (track per delivery for audit/ETA).
- **Consignee privacy:** the public `GET /track/:token` view exposes only the driver's *first* name +
  vehicle/plate/tier and live position — never full PII. Gated solely by the opaque per-delivery
  `trackingToken` (no account), matching the link/OTP model.
- **Delivery lifecycle** (`assigned → en_route_pickup → picked_up → en_route → delivered/failed`)
  drives driver status (idle on completion) and freight status (completed/cancelled); every transition
  is audited and pushed to `ops` + `delivery:<id>`.
- **Map projection** is a shared Bogotá bounding-box → 0–100% transform on the schematic `.map-grid`
  canvas (Mapbox stays swap-able behind `VITE_MAPBOX_TOKEN`). The driver dot animates via CSS
  transition between WS updates so motion looks smooth despite a 2.5s tick.
- Consignee tracking is served by the driver PWA at `/?track=<token>` (the link target), so one app
  covers both onboarding and tracking; it joins the `delivery:<id>` room for live updates.

## Phase 7
- **DriverScore is a pure, unit-tested weighted blend** (`scoring/score.ts`): normalized rating (0–5→
  0–100), completion, acceptance, on-time, and a recency decay (~2 pts/day since last delivery). Weights
  **and** tier thresholds come from the active `ScoringConfig` row (config, not code) and map score→tier
  (Élite 92 / Preferido 80 / Estándar 60 / Nuevo). Editing weights recomputes everyone.
- **Score drives tier drives wave order:** the same `tier` set by scoring feeds the Phase-5 wave engine,
  so better drivers get earlier tender access — the loop the brief asks for. Recompute runs on each
  completed/failed delivery and nightly (BullMQ `0 3 * * *`, Redis-optional).
- **Ratings reuse the delivery's tracking token** as the rating link (`/?rate=<token>`) — no second
  secret. Submission is public + idempotent (one rating per delivery, 400 on duplicate; must be
  delivered). On completion the consignee is auto-messaged the link via the templated WhatsApp adapter.
- **Completion hook wiring:** `TrackingService` (Phase 6) calls `RatingsService.requestRating` +
  `ScoringService.recomputeDriver` on `delivered`. To avoid a cycle, Tracking imports Ratings+Scoring
  (one direction). Verified: deliver → rating request logged → 5★ submit → score 96→99.5.
- **Priority batch** = premium (`priority`) freight surfaced to Outstanding (Elite) drivers first
  (`GET /freight/priority-batch?tier=`), with `accessibleNow` true only for Elite — the access gate is
  otherwise realized by the Elite-exclusive wave 0 already in the tender engine.

## Phase 8
- **One admin-only `ConfigController` (`/config/*`)** exposes CRUD for every config surface
  (document types, notification templates, operating areas, approval workflow/stages incl.
  reorder); scoring weights/tiers stay at `/scoring/config`. Each write is audited. Verified the
  loop the brief calls out: adding a `DocumentType` via admin immediately changes the public
  `/document-types` the onboarding form renders from — **no code change** — and a dispatcher gets 403.
- **Thin controllers inject repositories directly** for the config CRUD (no service layer) — these are
  straight persistence operations and a service would add indirection without value.
- Admin *Configuración* console has sub-sections for doc types, workflow (reorder + role/mode/security
  toggles), scoring (weights with a sum check + tier thresholds), templates (editable `{{var}}` body),
  and zones (activate/deactivate). The tab is hidden for non-admin roles client-side and enforced
  server-side.
- **Test coverage** concentrates on the pure engine logic the brief names (eligibility, scoring,
  reminders) plus pool/waves, OCR normalization and template interpolation — 37 unit tests, no DB or
  network needed, fast and deterministic.

## Post-MVP hardening
- **Driver authentication (done).** Drivers are `User`s (role `driver`) with passwords, so they log
  in through the same `/auth/login`. The access token now embeds `driverId` (the `DriverProfile` id,
  distinct from the user `sub`); `AuthService` loads the `driverProfile` relation at issue time and
  `refresh`/re-login re-derive it, so it self-heals. The four driver-facing routes no longer trust a
  client-supplied id: `tenders/:id/accept` + `/decline` and `tracking/ping` are `@Roles(DRIVER)` and
  read the id from the JWT; `deliveries/:id/status` requires auth and enforces ownership (a driver may
  only advance their own delivery, dispatcher/admin may advance any); `freight/priority-batch` (leaks
  payouts) now requires a driver/ops role. The GPS simulator calls `TrackingService.ping()` in-process
  so it is unaffected. Verified end-to-end (16 checks): body-`driverId`-without-token → 401, wrong role
  → 403, authorized accept via JWT, ownership 403 across drivers, ops override.

## Rebrand → PasarEx + Barbados localization + mobile browser
- **Brand.** All user-facing "Sherpa" became **PasarEx** (frontends, page titles, PWA manifest,
  API health/bootstrap strings, OCR request headers, notification title, seed console) and demo
  logins moved to `@pasarex.com` / `pasarex123`. The internal `@sherpa/*` npm workspace scope and
  infra identifiers (DB name `sherpa_lm`, container names, localStorage keys) were **left as-is** on
  purpose — renaming them is pure churn/risk with no user benefit.
- **Barbados.** `seed/bogota.ts` → `seed/barbados.ts`: the 10 Bogotá neighborhoods became the **11
  Barbados parishes** with real centroids; the map bounding box (both frontends) is now Barbados
  (`-59.66..-59.42`, `13.04..13.34`). Seed drivers/applicants/freight use Barbadian names, plate
  formats (`P 1234`), parish coverage, `+1246` phones, and **BBD** payouts (`Bds$`). Document types
  keep their keys (`soat`, `property`, `id` …) but display as Barbados equivalents (compulsory
  vehicle insurance, vehicle registration, national ID). The driver Terms now cite the **Barbados
  Data Protection Act, 2019** and Barbados governing law instead of Colombian Ley 1581.
- **Language.** English is the default in both apps (`useState('en')` + i18n context default); the
  ES/EN toggle and the Spanish strings stay in place (low-risk, reversible) since Barbados is English.
- **Mobile browser (not an app).** Driver PWA: the fixed 390×844 phone mock (`Phone`) now uses
  `.device-*` classes that fill the viewport under 480px (full-screen, no mock chrome, `100dvh`).
  Ops console: the fixed sidebar becomes an off-canvas drawer with a hamburger + backdrop under
  820px (`useIsMobile`), split panels `flex-wrap`, KPI/form grids use `auto-fit minmax`, and wide
  tables scroll horizontally (`.card > table` block+overflow). No native app is required.

## Document + ToS review for Ops
- **Where.** The applicant review lives in the Ops **Approvals** detail panel — the one surface all
  three reviewing roles (admin, dispatcher, security) already reach. Each submitted document now shows
  status + expiry and a **View** button; a modal fetches the file and renders it inline (image or PDF).
  The panel also shows the **Terms-of-Service acceptance** (version + timestamp, or "Not recorded").
- **File serving.** New `GET /documents/:id/file` streams the stored file (`StorageService.read`, mime
  by extension, `inline`), role-gated to admin/dispatcher/security. An `<img>`/`<iframe>` can't carry an
  auth header, so the admin client fetches the file as a **blob with the Bearer token** and renders an
  object URL — keeping the endpoint fully authenticated (verified: 401 no token, 403 driver, 404 unknown).
- **ToS source.** Acceptance is read from `Application.draft.termsAcceptedAt` / `termsVersion` (recorded
  at apply time, retained through submit) and added to the approval `detail` payload alongside document
  `id` + `hasFile`.
- **Scope note.** This targets applicants in the review queue (a prospective driver's submission). Active
  drivers who've left the queue aren't yet reviewable here; the seed's demo applicants also carry no
  uploaded files, so real review needs a submission made through the driver onboarding flow.

## Post-approval driver review, phone-login, and WhatsApp
- **Driver review on the Drivers panel (view-only, all three roles).** New `GET /drivers/:id/documents`
  returns the driver's `Document` rows (id, status, expiry, `hasFile`) + the ToS acceptance (from the
  driver's application draft) + phone/email. `GET /drivers` and `/drivers/:id/delivery-stats` were
  opened to `security_officer` too, so admin/dispatcher/security can all open a driver and view
  documents (reusing the `DocViewer` + the `/documents/:id/file` endpoint), ToS, and delivery stats.
  This complements the Approvals panel, which only reaches applicants still in the review queue.
- **Phone is the driver's username.** The onboarding wizard now requires the applicant to **create a
  password at the documents step** (kept in local component state — never written to the plaintext
  `draft` — and passed straight to submit, which argon2-hashes it). The account is created with
  `phone` set, and `validateUser` already matches email **or** phone, so drivers sign in with their
  phone number + password. The phone is also shown in the Drivers list + detail panel.
- **WhatsApp send + receive (Evolution API).** New `WhatsAppModule` + `whatsapp_messages` table
  (migration `1781130000000`). `POST /whatsapp/send` (admin/dispatcher) posts to Evolution
  `/message/sendText/{instance}` (number normalized to digits) and logs the outbound row;
  `POST /integrations/whatsapp/webhook?token=…` (`@Public`, shared-secret) ingests Evolution
  `messages.upsert` events as inbound rows; both fan out to the Ops room over WS (`whatsapp.message`).
  A new Ops **Messages** tab (admin/dispatcher) shows the live log + a composer. `POST
  /whatsapp/webhook/register` is an admin helper that points the Evolution instance at our webhook.
  **Graceful degradation:** with `EVOLUTION_API_KEY` empty, sends are logged as `skipped` (not sent) so
  the platform still runs. **To go live:** set `EVOLUTION_API_KEY` + a connected `EVOLUTION_INSTANCE`,
  set `NOTIFY_WHATSAPP_PROVIDER=whatsapp` (for templated notifications), and — since inbound needs
  Evolution to reach this API — expose the API publicly (or tunnel) and call the register helper so
  Evolution posts to `/api/integrations/whatsapp/webhook?token=<EVOLUTION_WEBHOOK_TOKEN>`.

## Freight rebuilt as a delivery-plan engine (bulk hub distribution)
- **Model.** The single-shipment freight/tender flow didn't fit real operations, so freight is
  now driven by an uploaded **delivery plan**: `DeliveryPlan` → per-parish `DeliveryPlanLine`
  (requiredPackages, preassignedDriverIds) → per-driver `PlanTender` (sized to the driver's
  vehicle). All pickup at a single hub ("PasarEx Hub").
- **Broadcast algorithm.** Order parishes **scarcest-first** (fewest eligible drivers → most, so the
  hardest-to-fill get first crack at the pool). Per parish: pre-assigned drivers get an
  auto-accepted tender (their vehicle capacity); the remaining demand is tendered to every eligible
  driver (security-cleared + eligible + covers the parish), each offered their vehicle's package
  capacity. Acceptance is accumulated under a row lock; once accepted ≥ required the line is FILLED
  and remaining OFFERED tenders are CANCELLED (drivers notified over WS). Plan completes when all
  lines fill.
- **Configurable freight profile.** Packages-per-vehicle is stored per plan (default van 120 / car 80
  / moto 50 / pickup 150 / bike 20), editable at plan creation.
- **Eligibility ≠ vehicle filter.** Unlike the old pool, vehicle type does NOT gate eligibility for a
  parish (any cleared driver covering it is eligible); it only sizes the tender quantity.
- **Intake.** Ops builds a plan by parish rows or uploads CSV/Excel (parsed client-side with SheetJS:
  columns parish/packages/preassigned); parish cells match by slug or localized name.
- **Kept alongside.** The legacy single-freight controller/tender engine and "Fletes" tab remain for
  now (they still power the consignee tracking/rating demo). Verified 14/14 end-to-end.
- **Not yet done:** a driver-facing UI to view/accept plan tenders (API + WS exist), and creating a
  `Delivery` (fulfillment/tracking) record when a driver accepts a plan tender.

## Known shortcuts (honest scope notes)
- Tender wave advancement and the GPS feed are in-process (`setTimeout` / interval) — correct for a
  single API instance; a multi-instance deploy would move these to BullMQ/durable timers.
- Barbados parish polygons are approximate boxes and eligibility uses parish membership rather
  than live `ST_Contains` (points are stored, so it can be switched on).
- OCR/WhatsApp/FCM are stubbed unless keyed; nothing external is required to run the whole platform.
