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

The governance spine (intake → evaluation → approval → dry-run distribution) is feature-complete
and running on oreochiserver in `dev_headers` auth mode. Live external write integrations
(Monday, GitHub, email intake, Chat slash command) are **not implemented** — only their specs
and mock executors exist. Don't provision real credentials for those expecting code to activate;
it doesn't exist yet.

Status buckets: **Built** (real, in the running app) · **Built, mock-only** (real code path, but
writes to a mock/in-memory implementation, not an external system) · **Built, env-gated** (real
code, inactive until a credential/env var is set — setting it does activate it) · **Spec-ready,
not implemented** (a task doc and contract exist; no executable code) · **Future** (unbuilt idea,
no spec yet).

| Subsystem | Status |
|-----------|--------|
| Intake lifecycle + governance | Built |
| Discovery Engine (ambiguity resolution) | Built — mock agents by default; live OpenAI/Anthropic/Bedrock via `AI_PROVIDER` |
| AI evaluation orchestrator (multi-agent) | Built — mock agents by default; `ANALYSIS_ENGINE=orchestrator` + `AI_PROVIDER` for live models |
| Multi-gate approval | Built |
| Distribution preview (dry-run) | Built |
| Provisioning execution + retry (incl. scheduled background retry) | Built, mock-only — `src/application/provisioning/mock-executor.ts`, no live Monday/GitHub executor exists |
| Monday adapter | Spec-ready, not implemented — see `docs/ai/tasks/TASK-0023D-monday-adapter.md`; no `MondayProvisioningExecutor` in code |
| GitHub adapter | Spec-ready, not implemented — see `docs/ai/tasks/TASK-0023E-github-adapter.md`; no GitHub provisioning executor in code |
| Email intake | Spec-ready, not implemented — see `docs/ai/tasks/TASK-0025-email-intake.md`; no `/intake-sources/email` route exists |
| Google Chat slash command | Spec-ready, not implemented — see `docs/ai/tasks/TASK-0026-google-chat-intake.md`; no `/intake-sources/chat` route exists |
| Google Chat notifications (outbound) | Built, env-gated — waiting for `GOOGLE_CHAT_WEBHOOK_URL` |
| Google OAuth | Built, env-gated — waiting for `AUTH_GOOGLE_CLIENT_ID` + `AUTH_GOOGLE_CLIENT_SECRET`; startup now fails fast if either is missing under `AUTH_MODE=google` |
| Roster API integration | Built, env-gated — client + scoring built, waiting for `ROSTER_API_URL`/`ROSTER_API_KEY`; upstream contract itself is still unverified (see `docs/EXTERNAL-NEEDS.md` §8) |
| Rate limiting | Built |
| AI cost governance + usage dashboard | Built |
| Post-distribution lifecycle | Built |
| Developer assignment + override | Built |

See `docs/EXTERNAL-NEEDS.md` for the credential/decision checklist for the env-gated items —
it does not cover Monday/GitHub/email/Chat-slash-command, since those need code, not just credentials.

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
npm run check          # typecheck + full test suite (738 tests; 5 known pre-existing
                        # failures in discovery workflow-status defaults, tracked in BUILD_LOG)

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

`/intake-sources/email` and `/intake-sources/chat` do not exist yet — they're spec-ready
(`docs/ai/tasks/TASK-0025-email-intake.md`, `TASK-0026-google-chat-intake.md`), not implemented.

---

## Repository map

```
src/domain/                   Workflow state machine, permissions, project types, provisioning rules
src/application/              Workflow service, evaluation orchestrator, provisioning executor
src/application/agents/       Mock evaluation agents (risk, work breakdown, clarification, assignment)
src/application/roster/       Roster API client, scoring algorithm, types
src/application/provisioning/ Provisioning executor, retry + backoff — mock executors only;
                               Monday/GitHub adapter contracts are specs in docs/ai/tasks/, not code
src/application/notifications/ Google Chat notifier
src/application/providers/    AI provider router (OpenAI, Anthropic, Bedrock, mock)

apps/api/src/                 NestJS API — controllers, modules, DTOs, Prisma store
apps/api/prisma/              Schema and migrations
apps/web/src/                 Next.js 15 review UI
apps/web/src/components/      Shared UI components (EvaluationPanel, AssignmentCard, etc.)

tests/                        Node test runner — 738 tests (5 known pre-existing failures)
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
| `npm test` | Run the full unit test suite |
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
