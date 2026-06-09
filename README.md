# Project Intake OS

Internal pre-distribution control plane for Digital Solutions project intake, AI-assisted analysis drafts, approval, dry-run provisioning, and controlled handoff to downstream tools.

## Current build state (TASK-0010)

The governance spine is complete. The NestJS API runtime is stable. The minimal Next.js review UI is running.

Verified path:

```text
AI drafts → Human reviews → Workflow approves → Distribution preview uses ReviewedProjectPackage → System distributes
```

Governance enforced:
- AI drafts are immutable, schema-backed, never autonomous
- Gate 1 approval requires a human-reviewed project package when AI drafts exist
- Distribution preview derives exclusively from the reviewed package
- Humans retain approval authority; AI may never approve or provision

Intentionally disabled:
- Live AI provider calls (OpenAI, Bedrock)
- Live GitHub/Monday writes
- Google SSO/RBAC (actor selector is dev auth shim)
- n8n (excluded from OS orchestration by ADR-0003)

---

## Prerequisites

- **Node.js 22+** (`node --version`)
- **npm 10+** (`npm --version`)
- **Docker + Docker Compose** (for Postgres and optional API container)

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` values work for local development without changes.

### 3. Start Postgres

```bash
docker compose up -d postgres
```

Postgres will be available at `localhost:5432`.

### 4. Generate Prisma client

```bash
npm run prisma:generate
```

### 5. Apply schema

First time (or after schema changes):

```bash
npm run prisma:migrate
```

Enter a migration name when prompted (e.g. `initial`).

> If you only want to push the schema without migration history, use:
> `npm run prisma:db:push`

### 6. Run core checks

```bash
npm run check
```

Expected: 49/49 tests passing.

### 7. Build API

```bash
npm run api:build
```

### 8. Start API (dev mode with watch)

```bash
npm run api:start:dev
```

API will listen on `http://localhost:3000`.

### 9. Smoke test (in another terminal)

```bash
npm run smoke:api
```

### 10. Start the web UI (separate terminal)

```bash
# Install web dependencies (first time only)
npm install --prefix apps/web

# Copy env for web
cp apps/web/.env.local.example apps/web/.env.local

# Start Next.js dev server
npm run web:dev
```

Open **http://localhost:3001**

---

## Browser walkthrough

Once the API and web are running:

1. Open http://localhost:3001 → redirects to `/intakes`
2. Select **Request Creator** actor (bottom of sidebar)
3. Click **Create Intake** → fill in the form → submit
4. Open the intake detail page
5. Click **Submit Intake** on the Overview tab
6. Switch to **Intake Owner** actor
7. Click **Generate Mock AI Draft**
8. Open the **AI Draft** tab → accept or revise the draft
9. Confirm the **Reviewed Package** tab shows the reviewed artifact
10. Open the **Approvals** tab → click **Approve Gate 1**
11. Switch to **DevOps Lead** actor
12. Click **Approve Gate 2**
13. Open the **Distribution** tab → click **Generate Distribution Preview**
14. Confirm source type is **Reviewed Project Package**
15. Open the **Audit Trail** tab to confirm all events

---

## Run with Docker Compose

Start both Postgres and the API:

```bash
docker compose up --build
```

Or start only Postgres (run API locally):

```bash
docker compose up -d postgres
```

Stop all services:

```bash
docker compose down
```

---

## Available endpoints

Swagger/OpenAPI: **http://localhost:3000/docs**

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness check |
| GET | /health/db | Readiness check (Postgres) |
| GET | /intakes | List all intakes |
| GET | /intakes/:id | Get a single intake |
| POST | /intakes | Create a manual intake |
| POST | /intakes/:id/submit | Submit draft for review |
| POST | /intakes/:id/discovery | Complete discovery |
| POST | /intakes/:id/analysis-drafts/mock | Generate mock AI analysis draft |
| POST | /intakes/:id/analysis-drafts/:draftId/accept | Accept draft as reviewed package |
| POST | /intakes/:id/analysis-drafts/:draftId/reject | Reject draft |
| POST | /intakes/:id/analysis-drafts/:draftId/revise | Revise draft into reviewed package |
| POST | /intakes/:id/approvals | Record Gate 1 or Gate 2 approval |
| POST | /intakes/:id/rejections | Reject at current gate |
| POST | /intakes/:id/provisioning-plan | Generate dry-run provisioning plan |
| POST | /intakes/:id/provisioning-ready | Mark plan ready for execution |
| GET | /intakes/:id/audit | Read audit trail |

---

## Actor headers (auth shim)

The POC uses HTTP headers instead of SSO:

```text
x-actor-id: user-devops
x-actor-role: devops_lead
x-actor-name: DevOps Lead
```

Canonical roles: `request_creator`, `intake_owner`, `devops_lead`, `developer`, `admin`

---

## Script reference

| Script | Command | Description |
|--------|---------|-------------|
| `npm run check` | typecheck + test | Full core verification |
| `npm run prisma:generate` | prisma generate | Generate Prisma client |
| `npm run prisma:migrate` | prisma migrate dev | Apply migrations (requires DB) |
| `npm run prisma:migrate:deploy` | prisma migrate deploy | Deploy migrations in production |
| `npm run prisma:studio` | prisma studio | Open Prisma Studio |
| `npm run api:build` | tsc + prisma generate | Compile NestJS API |
| `npm run api:start:dev` | nest start --watch | Start API in dev/watch mode |
| `npm run api:start` | node dist/... | Start compiled API |
| `npm run docker:up` | docker compose up -d | Start all services |
| `npm run docker:down` | docker compose down | Stop all services |
| `npm run smoke:api` | node scripts/smoke-api.mjs | API smoke test |
| `npm run web:dev` | next dev --port 3001 | Start web UI dev server |
| `npm run web:build` | next build | Build web UI |
| `npm run web:start` | next start --port 3001 | Start compiled web UI |
| `npm run demo:mvp` | node scripts/demo-iteration-2.mjs | No-AI workflow demo |
| `npm run demo:analysis` | node scripts/demo-analysis-draft.mjs | AI draft demo |
| `npm run demo:analysis-review` | node scripts/demo-analysis-review.mjs | Accept/revise draft demo |
| `npm run demo:review-guard` | node scripts/demo-reviewed-package-approval-guard.mjs | Gate 1 guard demo |
| `npm run demo:reviewed-distribution` | node scripts/demo-reviewed-package-distribution-preview.mjs | Distribution preview demo |

---

## Demo flows

Run all demos after `npm run check`:

```bash
npm run demo:mvp
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
```

---

## Repository map

```text
src/domain/              Framework-neutral domain logic (workflow, permissions, project types)
src/application/         Workflow service, store contracts, analysis drafts, provisioning plans
apps/api/src/            NestJS API layer (controllers, modules, DTOs, Prisma adapter)
apps/api/prisma/         Prisma schema and migrations
apps/api/Dockerfile      API container image
docker-compose.yml       Local Postgres + API runtime
tests/                   Node test runner tests (49 tests)
scripts/                 Demo scripts and smoke test
docs/product/            Product behavior source of truth
docs/ai/                 Build memory, task logs, ADRs, sequence log
```

---

## Troubleshooting

### `prisma: not found`

Run `npm install` — Prisma CLI is a dev dependency and must be installed.

### `DATABASE_URL missing`

Run `cp .env.example .env`. The default value is correct for local Docker Compose.

### `Postgres port already in use`

Either stop the existing Postgres process or change the port in `docker-compose.yml` and `.env`.

### Prisma client not generated

Run `npm run prisma:generate` before building or starting the API.

### Docker volume stale

```bash
docker compose down -v
docker compose up -d postgres
npm run prisma:migrate
```

### API cannot connect to database

When running the API locally (`api:start:dev`), use:
```
DATABASE_URL=postgresql://intake_os:intake_os_dev@localhost:5432/intake_os?schema=public
```

When running the API in Docker, use:
```
DATABASE_URL=postgresql://intake_os:intake_os_dev@postgres:5432/intake_os?schema=public
```
