# Project Intake OS — Demo Guide

**Build state:** TASK-0011 complete  
**Last updated:** 2026-06-10  
**Repo:** https://github.com/Dusty043/intake-os

---

## What is this?

The **Project Intake OS** is an internal pre-distribution control plane for Digital Solutions.

Every new project request flows through here before it reaches Monday or GitHub.

The system:
1. **Captures** the project request (title, description, project type, department)
2. **Generates** an AI-assisted analysis draft (complexity, tech stack, story point estimate, subtasks)
3. **Requires** a human reviewer to accept or revise the AI draft before anything moves forward
4. **Gates** distribution behind two human approval steps: Intake Owner (Gate 1) and DevOps Lead (Gate 2)
5. **Generates** a dry-run distribution preview derived from the human-reviewed package — not raw AI output
6. **Records** every action in an immutable audit trail

**Nothing distributes to Monday or GitHub until both approval gates are complete.**  
**AI assists — humans decide.**

---

## Where we are now

After 11 tasks, the core governance spine is complete and running.

### What's been built

| Layer | Status |
|-------|--------|
| Domain workflow state machine | ✅ Complete |
| Application service (workflow, approvals, AI drafts) | ✅ Complete |
| AI analysis draft contract (mock provider) | ✅ Complete |
| Human review lifecycle (accept / revise / reject draft) | ✅ Complete |
| Gate 1 guard: requires reviewed package before approval | ✅ Complete |
| Gate 2 approval | ✅ Complete |
| Distribution preview sourced from reviewed package | ✅ Complete |
| Audit trail on every event | ✅ Complete |
| NestJS API with Swagger | ✅ Complete |
| Postgres persistence via Prisma | ✅ Complete |
| Next.js browser UI | ✅ Complete |
| Seeded demo data (6 intakes across all stages) | ✅ Complete |
| Runtime smoke tests | ✅ Complete |

### What is intentionally not built yet

These are excluded by design for the MVP/POC — not forgotten:

| Item | Why excluded |
|------|-------------|
| Live AI provider (OpenAI / AWS Bedrock) | Waiting on compliance/provider decision |
| Google SSO | Replaced by actor header shim for POC |
| Live Monday board writes | Not until distribution task is approved |
| Live GitHub provisioning | Not until provisioning task is approved |
| n8n | Excluded by ADR-0003 — OS owns orchestration |

### Governance rules enforced in code

These are not just UI hints — they are hard-enforced in the application layer:

- AI drafts are **immutable** after generation. AI can never approve, modify an approval, or trigger provisioning.
- Gate 1 approval **requires** a human-reviewed package if any AI draft exists. You cannot approve past an AI draft without human review.
- Gate 2 **cannot** occur before Gate 1.
- Distribution preview source is **always** the reviewed project package — never raw AI output.
- All provisioning plan actions are **dry-run only** (`dryRun: true`). There is no live execute button.
- Completed approval records are **locked**. They cannot be modified after the fact.

---

## The governance flow

```
1. Request Creator submits an intake
           ↓
2. Intake Owner generates a mock AI analysis draft
           ↓
3. AI produces: complexity estimate, story points, tech stack recommendation,
   subtask breakdown, risk flags, missing information
           ↓
4. Human reviewer (Intake Owner) accepts, revises, or rejects the draft
   — Accept: draft fields become the reviewed package as-is
   — Revise: human edits the scope, estimates, or tech stack (AI values preserved for reference)
   — Reject: draft is discarded, intake stays in review
           ↓
5. Intake Owner approves Gate 1
   (blocked until a reviewed package exists)
           ↓
6. DevOps Lead approves Gate 2
           ↓
7. DevOps generates distribution preview
   (sourced from the reviewed package, not the AI draft)
           ↓
8. [Future] Execute provisioning → create GitHub repo + Monday cards
```

At every step, the audit trail records who did what and when.

---

## Setup

### What you need

- **Node.js 22+** — check with `node --version`
- **npm 10+** — check with `npm --version`
- **Docker + Docker Compose** — for Postgres

### Step-by-step

**1. Clone and install**

```bash
git clone https://github.com/Dusty043/intake-os.git
cd intake-os
npm install
```

**2. Set up environment**

```bash
cp .env.example .env
```

The defaults work out of the box for local development. No secrets needed.

**3. Start Postgres**

```bash
docker compose up -d postgres
```

Postgres starts on `localhost:5432`. Credentials are in `.env`.

**4. Apply the database schema**

```bash
npm run prisma:migrate
```

When prompted for a migration name, type anything (e.g. `initial`).

**5. Build the API**

```bash
npm run api:build
```

This compiles the TypeScript and generates the Prisma client. Should complete in ~10 seconds.

**6. Verify everything passes**

```bash
npm run check
```

Expected: **49/49 tests passing**.

**7. Seed demo data**

```bash
npm run seed:demo
```

Expected output:

```
Project Intake OS — Demo Data Seed
Database: postgresql://intake_os:***@localhost:5432/intake_os

  ✓ [1] Payment Failure Notification Fix          → draft
  ✓ [2] Marketing Dashboard Request               → submitted
  ✓ [3] Customer Portal Enhancement               → intake_review (AI draft generated, awaiting review)
  ✓ [4] Internal SSO Management Tool              → intake_review (reviewed package ready, Gate 1 available)
  ✓ [5] Data Pipeline Migration                   → devops_review (Gate 1 approved, Gate 2 pending)
  ✓ [6] Project Intake OS UI Buildout             → approved (approved, distribution preview: reviewed_project_package)

Seed complete — 6 demo records written to Postgres.
```

**8. Start the API** (keep this terminal running)

```bash
npm run api:start:dev
```

The API starts on `http://localhost:3000`. You'll see NestJS startup logs.

**9. Start the web UI** (new terminal)

```bash
npm install --prefix apps/web
cp apps/web/.env.local.example apps/web/.env.local
npm run web:dev
```

The web UI starts on `http://localhost:3001`.

**10. Open the browser**

```
http://localhost:3001/intakes
```

You should see the 6 seeded demo intakes.

---

## Exploring the demo data

### The actor selector

Bottom-left of the sidebar — you can switch between 5 roles:

| Actor | Role | Can do |
|-------|------|--------|
| Request Creator | `request_creator` | Create and submit intakes |
| Intake Owner | `intake_owner` | Review AI drafts, approve Gate 1 |
| DevOps Lead | `devops_lead` | Approve Gate 2, generate distribution preview |
| Admin | `admin` | Everything |
| Developer | `developer` | View only (no approvals) |

This replaces Google SSO for the POC. Your selected actor is sent as headers on every API call.

### The 6 demo intakes and what to explore

**1. Payment Failure Notification Fix** (`draft`)

Fresh intake. No AI analysis, no approvals, no audit trail beyond creation. Shows the empty starting state.

*Try:* open it and click **Submit Intake** as Request Creator. Watch it transition to `submitted`.

---

**2. Marketing Dashboard Request** (`submitted`)

Submitted and waiting for analysis. Shows what an intake looks like before an Intake Owner picks it up.

*Try:* switch to **Intake Owner**, click **Generate Mock AI Draft**, then explore the AI Draft tab.

---

**3. Customer Portal Enhancement** (`intake_review` — AI draft pending review)

An AI draft has been generated but no human has reviewed it yet. This is the most instructive intake.

**AI Draft tab** shows:
- Complexity, estimated story points, confidence score
- AI-generated brief (problem, solution, scope)
- AI-generated subtasks
- Missing information flags
- Warnings

**What to try:**
- Read the draft, then click **Accept Draft** (as Intake Owner)
- Or click **Revise Draft** to change the story points or tech stack
- After accepting, check the **Reviewed Package** tab — it should now show the human-reviewed artifact
- Try clicking **Approve Gate 1** without first reviewing the draft — you'll see the governance guard error

---

**4. Internal SSO Management Tool** (`intake_review` — reviewed package ready)

The AI draft has already been accepted and a reviewed package exists. Gate 1 is available.

**Reviewed Package tab** shows:
- All fields from the reviewed package (project type, complexity, story points, tech stack, brief, subtasks)
- The `reviewDecision: accepted` marker
- The reviewer's notes

*Try:* open **Approvals** tab, switch to **Intake Owner**, click **Approve Gate 1**. The status transitions to `devops_review`.

---

**5. Data Pipeline Migration** (`devops_review` — Gate 1 approved, Gate 2 pending)

Gate 1 is already done. Waiting for DevOps sign-off.

**Approvals tab** shows:
- Gate 1 card: approved, locked, with comment and timestamp
- Gate 2 card: pending, approve/reject buttons available

*Try:* switch to **DevOps Lead**, click **Approve Gate 2**. Status transitions to `approved`.

---

**6. Project Intake OS UI Buildout** (`approved` — full governance complete)

Everything is done. Both gates approved. Distribution preview generated.

**Distribution tab** shows:
- Source type: `reviewed_project_package` (not raw AI output)
- Dry-run actions for GitHub repo, Monday board, labels, README, etc.
- Each action shows `dryRun: true` — none of these fire for real

**Audit Trail tab** shows every event in chronological order:
- `INTAKE_CREATED`
- `INTAKE_SUBMITTED`
- `ANALYSIS_DRAFT_GENERATED`
- `ANALYSIS_DRAFT_ACCEPTED`
- `REVIEWED_PROJECT_PACKAGE_CREATED`
- `INTAKE_APPROVED` (Gate 1)
- `INTAKE_APPROVED` (Gate 2)
- `PROVISIONING_PLAN_GENERATED`

---

## Running the smoke tests

### Quick smoke (API health + CRUD)

With the API running:

```bash
npm run smoke:api
```

Checks: health endpoint, Swagger, list intakes, create, submit, mock draft, DB health.

### Full governance smoke

```bash
npm run smoke:runtime
```

Runs a fresh intake through the complete governance flow against the live API:

```
Phase 1 — Infrastructure
  ✓ GET /health returns {status: ok}
  ✓ GET /health/db reports database reachable
  ✓ GET /docs-json returns OpenAPI spec

Phase 2 — Intake CRUD
  ✓ GET /intakes returns array
  ✓ POST /intakes creates draft intake

Phase 3 — Submission
  ✓ POST /intakes/:id/submit transitions to submitted

Phase 4 — AI draft
  ✓ POST /intakes/:id/analysis-drafts/mock generates a draft
  ✓ Draft reviewStatus is immutable (AI cannot approve)

Phase 5 — Human review
  ✓ POST /intakes/:id/analysis-drafts/:draftId/accept creates reviewed package
  ✓ Gate 1 blocked until reviewed package exists (governance guard verified)

Phase 6 — Approval gates
  ✓ POST /intakes/:id/approvals (Gate 1) transitions to devops_review
  ✓ POST /intakes/:id/approvals (Gate 2) transitions to approved

Phase 7 — Distribution preview
  ✓ POST /intakes/:id/provisioning-plan generates dry-run plan
  ✓ Provisioning plan source is reviewed_project_package
  ✓ No live provisioning executed (dry-run only)

Phase 8 — Audit trail
  ✓ GET /intakes/:id/audit returns event history
  ✓ Audit trail contains INTAKE_CREATED event
  ✓ Audit trail contains ANALYSIS_DRAFT_GENERATED event
  ✓ Audit trail contains REVIEWED_PROJECT_PACKAGE_CREATED event

  Summary: 16 passed, 0 failed

Governance confirmed:
  AI drafts → Human review → Approval gates → Distribution preview (dry-run only)
```

### Reseed demo data

If you've made changes and want to reset to a clean demo state:

```bash
npm run seed:demo
```

This is safe to run any time — it only deletes records marked as demo data (`requester = demo.requester@local`). Your real records are not touched.

To wipe the entire database and start fresh:

```bash
npm run db:reset:demo
```

---

## Exploring the API directly

Swagger/OpenAPI browser: **http://localhost:3000/docs**

Key endpoints:

```
GET  /health                                       Liveness check
GET  /health/db                                    DB readiness
GET  /intakes                                      List all intakes
POST /intakes                                      Create intake
POST /intakes/:id/submit                           Submit
POST /intakes/:id/analysis-drafts/mock             Generate mock AI draft
POST /intakes/:id/analysis-drafts/:id/accept       Accept draft
POST /intakes/:id/analysis-drafts/:id/revise       Revise draft
POST /intakes/:id/approvals                        Gate 1 or Gate 2 approval
POST /intakes/:id/provisioning-plan                Generate distribution preview
GET  /intakes/:id/audit                            Audit trail
```

Actor headers for Swagger requests:

```
x-actor-id:   user-devops
x-actor-role: devops_lead
x-actor-name: DevOps Lead
```

Roles: `request_creator`, `intake_owner`, `devops_lead`, `developer`, `admin`

---

## Resetting and troubleshooting

**Port 3000 or 3001 already in use?**

```bash
lsof -ti:3000 | xargs kill   # stop whatever is on 3000
lsof -ti:3001 | xargs kill   # stop whatever is on 3001
```

**Prisma client not found?**

```bash
npm run prisma:generate
```

**API build errors?**

```bash
npm run api:build
```

**Database not reachable?**

```bash
docker compose up -d postgres     # ensure Postgres is running
npm run prisma:migrate             # ensure schema is applied
```

Check `http://localhost:3000/health/db` — should return `{"status":"ok","database":"reachable"}`.

**Want a completely clean slate?**

```bash
docker compose down -v            # wipe Postgres volume
docker compose up -d postgres     # fresh Postgres
npm run prisma:migrate             # reapply schema
npm run seed:demo                  # reseed
```

---

## What's next

After this pause point, the recommended sequence:

| Task | What it adds |
|------|-------------|
| TASK-0012 | Real AI provider adapter (OpenAI or AWS Bedrock) behind the existing draft contract |
| TASK-0013 | Team roster API integration and assignment scoring |
| TASK-0014 | Monday board mapping and configuration preview |
| TASK-0015 | GitHub provisioning adapter (mock/live split) |

None of these change the governance model. They plug in behind the existing interfaces.

---

## Summary

```
49 tests passing
NestJS API on :3000  (Swagger at /docs)
Next.js UI  on :3001
6 seeded demo intakes across all workflow stages
Full governance flow verified end-to-end
AI assists — humans decide — audit trail proves it
```
