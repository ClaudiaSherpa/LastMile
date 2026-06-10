## Role & Goal

You are building an **Uber-style on-demand last-mile delivery platform**. It onboards and vets drivers/vehicles, broadcasts available freight as tenders, ranks drivers by performance, tracks deliveries live by GPS, manages document compliance with expiry reminders, and collects consignee ratings that feed back into driver priority.

Build a working, well-structured MVP across the phases below. Commit after each phase. Default to sensible choices and keep moving; surface assumptions in a `DECISIONS.md` rather than pausing for approval.

## Tech Stack (use unless you have a strong reason not to)

- **Backend:** Node.js + TypeScript, NestJS (modular, good for workflow/queue domains)
- **Database:** PostgreSQL + **PostGIS** (operating-area polygons, geo radius, GPS), Prisma or TypeORM
- **Cache / pub-sub / queues:** Redis + BullMQ (tender broadcasts, reminder jobs, scheduled checks)
- **Real-time:** WebSockets (Socket.IO) for live GPS and tender push
- **Notifications:** pluggable provider interface with adapters for push (FCM), whatsapp with Evolution API hosted at http://159.65.224.135:8080/. Default to a console/stub adapter in dev so nothing external is required to run.
- **Admin web:** React + Vite + Tailwind (config consoles, approval queue, live map)
- **Driver app:** PWA (React) for MVP; structure the API so a React Native app can reuse it later
- **Maps:** Mapbox GL (swap-able)
- **Auth:** JWT + refresh tokens, role-based access control

Put all integration keys behind env vars; the app must boot and run end-to-end with stub providers and seed data, no paid accounts required.

## Core Roles

`driver`, `dispatcher`, `security_officer`, `admin`, `consignee` (consignee is link/OTP-based, no full account).

## Data Model (baseline — extend as needed)

- **User / DriverProfile / Vehicle** — vehicle has type, capacity (weight + volume), dimensions, refrigeration flag, plate, year.
- **DocumentType (CONFIG)** — name, applies-to (driver|vehicle), `required` flag, `tracksExpiry` flag, accepted file types, validation rules, reminder offsets. Seed with: driver license, vehicle insurance, **SOAT**, vehicle registration — but everything is editable in an admin console, not hardcoded.
- **Document** — instance of a DocumentType: file ref, issue/expiry date, status (pending|approved|rejected|expired).
- **OperatingArea** — named PostGIS polygon; drivers select one or more.
- **AvailabilitySlot** — recurring weekly windows + ad-hoc on/off-duty toggle.
- **ApprovalWorkflow (CONFIG)** → ordered **ApprovalStage**s → **ApprovalTask**s. Each stage: name, responsible role, manual or automatic, required documents, SLA, pass/fail/return-to-applicant outcomes. Must include a **security-clearance stage** that gates volume assignment.
- **Freight / Shipment** — pickup + dropoff geopoints, time window, vehicle requirements (type, capacity), consignee contact through app no personal data visible to the driver, priority flag.
- **Tender** + **TenderResponse** — a broadcast offer of a shipment, the ranked eligibility list, the wave/window each driver was offered in, and accept/decline/expire outcomes.
- **Delivery** + status timeline (assigned → en route to pickup → picked up → en route → delivered/failed).
- **LocationPing** — driver GPS stream (time, lat/lng, heading, speed).
- **Rating / Feedback** — per delivery, from consignee.
- **DriverScore** — computed metric + tier (see ranking).
- **Reminder / Notification** — scheduled + sent records.

## Feature Modules

### 1. Onboarding & Application
Multi-step application capturing driver identity, license, vehicle characteristics, **SOAT**, insurance, operating areas, and time availability. Document upload tied to the **configurable** DocumentType set — the form renders from config, so adding a doc type in admin changes the application automatically. Save-and-resume; clear status to the applicant.

### 2. Configurable Approval & Security Vetting
A workflow engine that runs an applicant through the admin-defined stages. Each stage is manual (assigned to a role's queue) or automatic (rules on submitted data). The **security-clearance stage is mandatory and blocks any volume/tender eligibility until passed.** Admins build/reorder stages in a console — do not hardcode the pipeline. Log every decision with actor, timestamp, reason.

### 3. Document Compliance & Reminders
For every document with `tracksExpiry`, schedule reminders at admin-configured offsets (e.g. 30/15/3 days before expiry) for **insurance, SOAT, and license renewals**. A daily job flags expired/expiring docs, notifies the driver + dispatcher, and **auto-suspends tender eligibility** when a required document lapses, restoring it on renewal.

### 4. Freight Broadcast & Tender Engine
When a shipment is posted, compute the **eligible driver pool**: approved + security-cleared, valid required docs, vehicle meets requirements, dropoff/pickup within an operating area, currently on-duty/available. Rank the pool by DriverScore (below) and broadcast in **priority waves** — top-tier drivers get an exclusive early acceptance window before the offer widens to the rest. First valid accept wins; handle declines, timeouts, and re-broadcast. "Outstanding" drivers also get first access to a **priority batch** of premium freight. Everything pushed in real time over WebSockets.

### 5. Real-Time GPS Tracking
Driver app streams location pings while on-duty/on-delivery. Dispatcher map shows live positions; consignee gets a tracking link for the active delivery. Store the track per delivery for audit and ETA.

### 6. Ratings & Driver Priority
On delivery completion, the consignee automatically receives a message (WhatsApp/SMS/link) to rate the driver and leave feedback. **DriverScore** = weighted blend of average rating, completion rate, acceptance rate, on-time rate, and recency; it maps to tiers (e.g. Bronze→Platinum). Score drives tender wave order and priority-batch access. Make the weights and tier thresholds config values, and recompute scores on each completed delivery + nightly.

### 7. Admin Console
Manage document types, approval workflows, operating areas, scoring weights/tiers, reminder offsets, and notification templates — all without code changes. Plus: approval queues, live delivery map, driver/vehicle directory, compliance dashboard.

## Cross-Cutting Requirements

- **Configuration over hardcoding** for documents, approval stages, reminders, scoring, and notification templates — this is a primary goal, not a nice-to-have.
- **Notifications** go through one interface; all user-facing copy lives in editable templates with variable interpolation, multi-language ready (default English + Spanish, given Latin American SOAT context).
- **Audit logging** on approvals, eligibility changes, and document status.
- RBAC enforced server-side on every endpoint.
- Seed script with realistic demo data (drivers at various approval stages, vehicles, operating-area polygons, sample shipments) so the whole flow is demoable immediately.
- README with run instructions; `docker-compose` for Postgres+PostGIS+Redis; `.env.example`.

## Build Order (commit per phase)

1. Scaffold monorepo, docker-compose, DB schema + migrations, auth + RBAC, seed data.
2. Onboarding + configurable DocumentTypes + document upload.
3. Configurable approval workflow engine + security stage + admin approval queue.
4. Document expiry reminders + eligibility auto-suspend (BullMQ jobs).
5. Shipment creation + tender engine + priority-wave broadcast (WebSockets).
6. GPS streaming + dispatcher live map + consignee tracking link.
7. Ratings/feedback + DriverScore + tiering + priority batch wiring.
8. Admin console for all config surfaces; polish, docs, tests on core engine logic.

## How to work

- Decide stack details, library choices, and schema specifics yourself; record notable choices in `DECISIONS.md`.
- Write tests for the tender-eligibility, scoring, and reminder logic.
- Keep everything runnable with stub providers — no external paid services needed to start.
- Only pause to ask me if a decision is costly to reverse or changes the product's scope.


## UI

Fetch this design file, read its readme, and implement the relevant aspects of the design. https://api.anthropic.com/v1/design/h/s87TElsdy825PAIj2fr22Q?open_file=index.html
Implement: index.html