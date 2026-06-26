# Project Intake OS

Internal pre-distribution control plane for Digital Solutions project intake — AI-assisted evaluation, multi-gate approval, dry-run provisioning, and controlled handoff to Monday, GitHub, and Google Chat.

## What it does

A project request enters as an intake. It moves through a governed workflow:

```
Create → Submit → AI Evaluation → Human Review → Gate 1 → Gate 2 → Distribution Preview → Provision
```

The app owns the governance spine. Monday and GitHub receive the output. Developers work in those tools. The OS does not sync back.

**Governance enforced:**
- AI evaluates, AI never approves
- Gate 1 requires a human-reviewed project package
- Gate 2 requires Gate 1 to be complete
- Distribution only executes after both gates pass
- All approvals, overrides, and provisioning runs are audited
- Rejected and archived requests cannot provision
- Retries are idempotent — no duplicate downstream resources

---

## Build state

Feature-complete for the defined scope. Running on oreochiserver in `dev_headers` auth mode. Waiting for external credentials to activate live integrations.

| Subsystem | Status |
|-----------|--------|
| Intake lifecycle + governance | Complete |
| Discovery Engine (ambiguity resolution) | Complete — live OpenAI agents (gpt-5.5 orchestration / gpt-5.4-mini tasks) |
| AI evaluation orchestrator (multi-agent) | Complete — mock agents |
| Multi-gate approval | Complete |
| Distribution preview (dry-run) | Complete |
| Provisioning execution + retry | Complete — mock executors |
| Monday adapter | Built — waiting for `MONDAY_API_TOKEN` + board config |
| GitHub adapter | Built — waiting for `GITHUB_PAT` + org config |
| Google Chat notifications | Built — waiting for `GOOGLE_CHAT_WEBHOOK_URL` |
| Email intake | Built — waiting for service choice + `INTAKE_WEBHOOK_SECRET` |
| Google Chat slash command | Built — waiting for GCP credentials |
| Google OAuth | Built — waiting for `AUTH_GOOGLE_CLIENT_ID` + `AUTH_GOOGLE_CLIENT_SECRET` |
| Roster API integration | Built — waiting for `ROSTER_API_URL` |
| Rate limiting | Complete |
| AI cost governance + usage dashboard | Complete |
| Post-distribution lifecycle | Complete |
| Developer assignment + override | Complete |

See `docs/EXTERNAL-NEEDS.md` for the complete activation checklist, ordered by effort.

---

## Prerequisites

- **Node.js 22+**
- **npm 10+**
- **Docker + Docker Compose**

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start Postgres
docker compose up -d postgres

# 4. Generate Prisma client + apply schema
npm run prisma:generate
npm run prisma:migrate

# 5. Verify
npm run check          # typecheck + 685 tests

# 6. Build and start API
npm run api:build
npm run api:start:dev  # http://localhost:3000

# 7. Seed demo data
npm run seed:demo

# 8. Start web UI (separate terminal)
cp apps/web/.env.local.example apps/web/.env.local
npm run web:dev        # http://localhost:3001/intakes
```

---

## Seeded demo data

`npm run seed:demo` creates demo intakes across every workflow stage:

| Title | Status |
|-------|--------|
| Payment Failure Notification Fix | `draft` |
| Marketing Dashboard Request | `submitted` |
| Customer Portal Enhancement | `intake_review` — AI draft, no reviewed package |
| Internal SSO Management Tool | `intake_review` — reviewed package ready, Gate 1 available |
| Data Pipeline Migration | `devops_review` — Gate 1 approved, Gate 2 pending |
| Project Intake OS UI Buildout | `approved` — both gates approved, distribution preview ready |

Safe to re-run — deletes only demo records (identified by `requester = demo.requester@local`).

```bash
npm run db:reset:demo   # prisma migrate reset + seed
```

---

## Auth mode

The server runs `AUTH_MODE=dev_headers` by default. A role switcher in the bottom-left sidebar sends an `X-Actor-Role` header. No login required.

Roles: `request_creator` `intake_owner` `devops_lead` `developer` `admin`

To use real Google auth, set `AUTH_MODE=google` and provide the GCP credentials from `docs/EXTERNAL-NEEDS.md`.

---

## API reference

Swagger/OpenAPI: **http://localhost:3000/docs**

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness check |
| GET | /health/db | Readiness check |
| GET | /intakes | List intakes |
| GET | /intakes/:id | Get intake |
| POST | /intakes | Create intake |
| POST | /intakes/:id/submit | Submit for review |
| POST | /intakes/:id/resubmit | Resubmit with clarification answers |
| POST | /intakes/:id/analysis-drafts/mock | Generate mock AI analysis draft |
| POST | /intakes/:id/analysis-drafts/regenerate | Regenerate with guidance |
| POST | /intakes/:id/analysis-drafts/:draftId/accept | Accept draft → reviewed package |
| POST | /intakes/:id/analysis-drafts/:draftId/reject | Reject draft |
| POST | /intakes/:id/analysis-drafts/:draftId/revise | Revise draft → reviewed package |
| POST | /intakes/:id/approvals | Gate 1 or Gate 2 approval |
| POST | /intakes/:id/rejections | Reject at current gate |
| POST | /intakes/:id/request-changes | Request changes before gate |
| POST | /intakes/:id/provisioning-plan | Generate dry-run distribution preview |
| POST | /intakes/:id/provisioning-ready | Mark plan ready for execution |
| POST | /intakes/:id/distribution/execute | Execute provisioning |
| POST | /intakes/:id/distribution/runs/:runId/retry | Retry failed run |
| POST | /intakes/:id/assignment | Override developer assignment |
| DELETE | /intakes/:id/assignment | Clear assignment override |
| POST | /intakes/:id/lifecycle/:action | Post-distribution lifecycle transition |
| GET | /intakes/:id/audit | Audit trail |
| GET | /intakes/:id/evaluations | List evaluations |
| GET | /admin/ai-usage | AI usage by model and role |
| GET | /admin/ai-usage/summary | Monthly AI usage summary |
| POST | /intake-sources/email | Inbound email webhook |
| POST | /intake-sources/chat | Google Chat slash command webhook |

---

## Repository map

```
src/domain/                   Workflow state machine, permissions, project types, provisioning rules
src/application/              Workflow service, evaluation orchestrator, provisioning executor
src/application/agents/       Mock evaluation agents (risk, work breakdown, clarification, assignment)
src/application/roster/       Roster API client, scoring algorithm, types
src/application/provisioning/ Provisioning executor, retry + backoff, Monday and GitHub adapters
src/application/notifications/ Google Chat notifier
src/application/providers/    AI provider router (OpenAI, Anthropic, Bedrock, mock)

apps/api/src/                 NestJS API — controllers, modules, DTOs, Prisma store
apps/api/prisma/              Schema and migrations
apps/web/src/                 Next.js 15 review UI
apps/web/src/components/      Shared UI components (EvaluationPanel, AssignmentCard, etc.)

tests/                        Node test runner — 685 tests
scripts/                      Demo scripts, smoke tests, seed data
deploy/                       Server deployment scripts and healthcheck

docs/product/                 Product behavior source of truth (state machine, permissions, etc.)
docs/ai/                      Build log, task logs, ADRs, open questions
docs/EXTERNAL-NEEDS.md        Pre-production credential checklist, ordered by effort
```

---

## Private server runtime

The production instance runs on oreochiserver (Tailscale: `100.75.210.83`). Access via SSH tunnel:

```bash
ssh -L 8080:localhost:8080 oreo@100.75.210.83
# Then open: http://localhost:8080/intakes
```

The Caddy proxy binds `127.0.0.1:8080` only — not reachable over Tailscale directly.

### Start / stop

```bash
# On the server:
cd ~/intake-os
docker compose -f docker-compose.server.yml --env-file .env.server up -d
docker compose -f docker-compose.server.yml --env-file .env.server ps
bash deploy/healthcheck-server.sh
```

### Seed on server

```bash
docker compose -f docker-compose.server.yml --env-file .env.server exec api npm run seed:demo:server
```

### Backup

```bash
npm run server:backup
bash deploy/restore-postgres.sh backups/intake_os_YYYYMMDD_HHMMSS.sql
```

### Activating integrations

Edit `/home/oreo/intake-os/.env.server` on the server, then restart:

```bash
docker compose -f docker-compose.server.yml --env-file .env.server up -d api web
```

See `docs/EXTERNAL-NEEDS.md` for the full list of env vars and where to get each credential.

---

## Script reference

| Script | Description |
|--------|-------------|
| `npm run check` | Typecheck + full test suite |
| `npm test` | Run 685 unit tests |
| `npm run typecheck` | TypeScript check only |
| `npm run build:core` | Compile domain + application layer |
| `npm run api:build` | Compile NestJS API |
| `npm run api:start:dev` | Start API in watch mode (port 3000) |
| `npm run web:dev` | Start Next.js UI in dev mode (port 3001) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Apply schema migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed:demo` | Seed 6 demo intakes (local) |
| `npm run db:reset:demo` | Reset DB and reseed |
| `npm run smoke:api` | API health smoke test |
| `npm run smoke:runtime` | Full governance flow smoke test |
| `npm run server:build` | Build server Docker images |
| `npm run server:up` | Start server stack |
| `npm run server:down` | Stop server stack |
| `npm run server:logs` | Follow all container logs |
| `npm run server:health` | Run server healthcheck |
| `npm run server:deploy` | Pull + build + start |
| `npm run server:backup` | Dump Postgres to backups/ |

---

## Troubleshooting

**`prisma: not found`** — run `npm install`.

**`DATABASE_URL missing`** — run `cp .env.example .env`.

**Postgres port already in use** — stop the existing process or change the port in `docker-compose.yml`.

**Prisma client not generated** — run `npm run prisma:generate` before building.

**Docker volume stale:**
```bash
docker compose down -v
docker compose up -d postgres
npm run prisma:migrate
```

**API can't connect (local vs Docker):**
- Local API: `DATABASE_URL=postgresql://intake_os:intake_os_dev@localhost:5432/intake_os?schema=public`
- API in Docker: `DATABASE_URL=postgresql://intake_os:intake_os_dev@postgres:5432/intake_os?schema=public`
