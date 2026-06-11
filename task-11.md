# TASK-0011 — End-to-End Runtime Smoke & Seeded Demo Data

## Status

Planned

## Purpose

TASK-0005 through TASK-0008 completed the backend governance spine:

```text
AI drafts
→ Human reviews
→ Workflow approves
→ Distribution preview uses ReviewedProjectPackage
→ System distributes later
```

TASK-0009 stabilized the backend API runtime.

TASK-0010 added the minimal Next.js review UI.

TASK-0011 makes the project easy to run, reset, demo, and verify end-to-end.

The goal is:

```text
A clean local environment can be seeded with useful demo data,
then verified through API smoke tests and the browser UI.
```

This task is not about new product capability. It is about making the current MVP loop reliable for demos and future development.

---

# Current State

Current verified repository state:

```text
49/49 core tests passing
api:build passing
web:build passing
prisma:generate passing
all 5 demos passing
smoke:api script exists
Next.js UI exists
.next cache removed and ignored
```

Current runtime startup flow:

```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run api:start:dev   # terminal 1
npm run smoke:api       # terminal 2
npm run web:dev         # terminal 3
```

Current browser URL:

```text
http://localhost:3001
```

Current API URL:

```text
http://localhost:3000
```

---

# Problem

The app now works, but demo setup still requires manual effort.

A developer or stakeholder demo should not require creating every intake from scratch.

We need seeded local demo data that shows the major workflow stages:

```text
Draft intake
Submitted intake
AI draft available
Reviewed package available
Gate 1 approved
Gate 2 approved
Distribution preview ready
```

We also need a runtime smoke path that can prove the API, database, and workflow still work together.

---

# Product Goal

After TASK-0011, a developer should be able to run:

```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo
npm run api:start:dev
npm run smoke:api
npm run web:dev
```

Then open the UI and see useful demo data immediately.

The demo data should let a user inspect:

```text
AI draft
human-reviewed package
approval gates
distribution preview
audit trail
```

without manually building all records first.

---

# Non-Negotiable Rules

1. Do not add live AI provider calls.
2. Do not add live Monday API writes.
3. Do not add live GitHub provisioning.
4. Do not introduce n8n.
5. Do not add Google SSO.
6. Do not weaken governance rules.
7. Do not fake backend states only in the frontend.
8. Seed data must go through application services where practical.
9. Seeded data must preserve audit trail behavior.
10. Existing tests, demos, API build, and web build must continue to pass.
11. Demo data must be clearly marked as local/dev/demo data.
12. No real secrets or client data.

---

# Scope

## In Scope

Add:

```text
seed demo data script
reset local database helper if practical
seeded demo intakes across workflow stages
extended API smoke path if practical
README demo setup section
AI build log updates
```

## Out of Scope

Do not implement:

```text
real AI provider integration
real roster API integration
Monday live creation
GitHub live provisioning
Google SSO
production seed process
deployment
frontend redesign
new product workflow states
n8n
```

---

# Required Demo Data

Create seeded records that demonstrate the full OS flow.

Recommended seeded intakes:

## 1. Draft Intake

```text
Title: Payment Failure Notification Fix
Project Type: API Service or Internal Tool
Status: draft
Purpose: shows fresh intake before submission
```

Should show:

```text
no AI draft
no reviewed package
no approvals
no distribution preview
minimal audit trail
```

---

## 2. Submitted Intake

```text
Title: Marketing Dashboard Request
Project Type: Dashboard
Status: submitted
Purpose: shows intake ready for analysis
```

Should show:

```text
submitted status
no AI draft yet
action available to generate mock AI draft
audit trail includes creation + submission
```

---

## 3. AI Draft Available Intake

```text
Title: Customer Portal Enhancement
Project Type: Web App
Status: intake_review
Purpose: shows generated AI draft awaiting human review
```

Should show:

```text
latestAnalysisDraft exists
reviewedProjectPackage missing
Gate 1 blocked until review
AI Draft tab populated
audit trail includes analysis draft generation
```

---

## 4. Reviewed Package Intake

```text
Title: Internal SSO Management Tool
Project Type: Internal Tool
Status: intake_review
Purpose: shows reviewed artifact before Gate 1 approval
```

Should show:

```text
latestAnalysisDraft exists
reviewedProjectPackage exists
review decision accepted or revised
Gate 1 approval available
Reviewed Package tab populated
audit trail includes draft review
```

---

## 5. Gate 1 Approved Intake

```text
Title: Data Pipeline Migration
Project Type: Data Pipeline
Status: devops_review
Purpose: shows intake waiting for DevOps approval
```

Should show:

```text
reviewedProjectPackage exists
Gate 1 approved
Gate 2 pending
approval panel populated
audit trail includes Gate 1 approval
```

---

## 6. Approved + Distribution Preview Intake

```text
Title: Project Intake OS UI Buildout
Project Type: Internal Tool
Status: approved
Purpose: shows fully approved intake with dry-run distribution preview
```

Should show:

```text
reviewedProjectPackage exists
Gate 1 approved
Gate 2 approved
provisioningPlan exists
provisioningPlan.source.type = reviewed_project_package
Distribution tab populated
dry-run actions visible
audit trail includes provisioning plan generation
```

---

# Seed Implementation Requirements

## Script

Add:

```text
scripts/seed-demo-data.mjs
```

Root package script:

```json
{
  "scripts": {
    "seed:demo": "node scripts/seed-demo-data.mjs"
  }
}
```

Optional reset script:

```json
{
  "scripts": {
    "db:reset:demo": "npm run prisma:migrate:reset && npm run seed:demo"
  }
}
```

Only add `db:reset:demo` if the existing Prisma reset command is safe and clear.

---

# Seed Strategy

Preferred strategy:

```text
Use the existing application service methods where practical.
```

That means seeded records should be created by calling the same workflow methods used by tests/demos:

```text
createIntake
submitIntake
generateMockAnalysisDraft
acceptAnalysisDraft
reviseAnalysisDraft
recordApproval
generateProvisioningPlan
```

This preserves:

```text
valid statuses
audit events
approval guards
review guards
distribution source metadata
```

Avoid directly writing final JSON states unless necessary.

If the Prisma store requires direct setup, keep it minimal and document why.

---

# Persistence Target

Seed data must write to the same Postgres database used by the NestJS API.

Expected:

```text
Prisma-backed ProjectIntakeStore
Postgres running through Docker Compose
DATABASE_URL from .env
```

Do not seed only the in-memory store.

The UI should read the seeded records through the API.

---

# Idempotency Requirements

Running `npm run seed:demo` multiple times should not create uncontrolled duplicate data.

Acceptable approaches:

## Option A — Clear existing demo data first

Delete only demo records with a clear marker:

```text
source = demo_seed
or
metadata.demoSeed = true
or
requester contains demo.local
```

Then recreate them.

## Option B — Upsert by stable IDs

Use stable IDs if supported.

Recommended stable IDs:

```text
demo-draft-payment-failure
demo-submitted-marketing-dashboard
demo-ai-draft-customer-portal
demo-reviewed-internal-sso
demo-gate1-data-pipeline
demo-approved-intake-os-ui
```

Option A is likely simpler.

Do not delete non-demo records accidentally.

---

# Demo Data Marker

Every seeded intake should include a clear marker.

Examples:

```text
source: demo_seed
requester: demo.requester@local
```

or metadata:

```json
{
  "demoSeed": true
}
```

If the current model does not support metadata cleanly, use a consistent source/requester value.

---

# Extended Smoke Test

Update or add smoke coverage.

Current script:

```text
scripts/smoke-api.mjs
```

It already checks:

```text
health
Swagger
list intakes
create intake
submit intake
optional mock draft
optional DB health
```

TASK-0011 should either extend this script or add a new one.

Recommended:

```text
scripts/smoke-runtime-workflow.mjs
```

Package script:

```json
{
  "scripts": {
    "smoke:runtime": "node scripts/smoke-runtime-workflow.mjs"
  }
}
```

If simpler, extend `smoke:api`.

---

# Runtime Smoke Requirements

The runtime smoke should verify:

```text
GET /health works
GET /health/db works when DB is available
GET /intakes returns seeded records after seed
POST /intakes works
POST /intakes/:id/submit works
POST /intakes/:id/analysis-drafts/mock works
accept or revise draft works
Gate 1 approval works after review
Gate 2 approval works
provisioning plan generation works
provisioning plan source is reviewed_project_package
GET /intakes/:id/audit returns expected events
```

This should be a live API smoke test, not a unit test.

It should require:

```text
running Postgres
running NestJS API
```

It should not require:

```text
running Next.js web app
external AI key
Monday key
GitHub key
Google auth
```

---

# UI Demo Walkthrough Requirement

Seeded demo data should support this browser walkthrough:

```text
1. Start Postgres.
2. Run migrations.
3. Seed demo data.
4. Start API.
5. Start web.
6. Open /intakes.
7. Confirm multiple seeded intakes appear.
8. Open AI Draft Available intake.
9. Confirm AI Draft tab is populated and Reviewed Package is empty.
10. Open Reviewed Package intake.
11. Confirm reviewed package is visible.
12. Open Gate 1 Approved intake.
13. Confirm Gate 2 can be approved using DevOps Lead actor.
14. Open Approved + Distribution Preview intake.
15. Confirm Distribution tab shows dry-run actions sourced from Reviewed Project Package.
16. Open Audit Trail tab.
17. Confirm events are visible.
```

---

# README Updates

Update README with a new section:

```text
Seeded Demo Data
```

Include:

```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo
npm run api:start:dev
npm run web:dev
```

Add smoke instructions:

```bash
npm run smoke:api
# or
npm run smoke:runtime
```

Add browser URL:

```text
http://localhost:3001/intakes
```

Add note:

```text
Seeded demo records are local-only and should not contain real client data.
```

---

# .env.example Updates

Only update if needed.

Ensure these exist:

```dotenv
DATABASE_URL=postgresql://intake_os:intake_os_password@localhost:5432/intake_os?schema=public
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
API_PORT=3000
API_HOST=0.0.0.0
```

No real secrets.

---

# Suggested File Touch List

Likely files:

```text
scripts/seed-demo-data.mjs
scripts/smoke-api.mjs
scripts/smoke-runtime-workflow.mjs
package.json
README.md
docs/ai/tasks/TASK-0011-end-to-end-runtime-smoke-and-seeded-demo-data.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

Possible files:

```text
src/application/intake-workflow-service.ts
src/application/types.ts
apps/api/src/persistence/prisma-project-intake-store.ts
.env.example
```

Avoid modifying core workflow unless a bug is discovered.

---

# Implementation Order

## Step 1 — Read context

Read:

```text
README.md
docs/ai/MEMORY_INDEX.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/tasks/TASK-0010-minimal-nextjs-review-ui.md
scripts/smoke-api.mjs
scripts/demo-*.mjs
src/application/intake-workflow-service.ts
apps/api/src/persistence/prisma-project-intake-store.ts
```

## Step 2 — Run baseline

Run:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Record baseline in build log.

## Step 3 — Design seed data

Define the six seeded demo intakes listed in this spec.

Use realistic but fake local data.

Do not use real client names, real emails, or real project contents.

## Step 4 — Implement seed script

Add:

```bash
npm run seed:demo
```

Script should:

```text
connect to Prisma/Postgres
remove or upsert existing demo records
create records through application service where practical
print created record IDs and statuses
exit non-zero on failure
```

Expected console output example:

```text
Seeded demo data:
- demo-draft-payment-failure → draft
- demo-submitted-marketing-dashboard → submitted
- demo-ai-draft-customer-portal → intake_review
- demo-reviewed-internal-sso → intake_review
- demo-gate1-data-pipeline → devops_review
- demo-approved-intake-os-ui → approved + provisioning plan
```

## Step 5 — Verify UI reads seeded data

Start API and web.

Open:

```text
http://localhost:3001/intakes
```

Confirm seeded records appear.

## Step 6 — Add or extend runtime smoke

Add:

```bash
npm run smoke:runtime
```

or extend:

```bash
npm run smoke:api
```

The smoke test should prove the live API can execute the AI-assisted flow through approval and distribution preview.

## Step 7 — Update README

Document:

```text
seed command
runtime smoke command
demo walkthrough
reset/reseed workflow
```

## Step 8 — Update AI logs

Update:

```text
docs/ai/tasks/TASK-0011-end-to-end-runtime-smoke-and-seeded-demo-data.md
docs/ai/BUILD_LOG.md
docs/ai/SEQUENCE_LOG.md
docs/ai/MEMORY_INDEX.md
```

## Step 9 — Final verification

Run offline/build verification:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Run live runtime verification:

```bash
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo
npm run api:start:dev
npm run smoke:api
npm run smoke:runtime
npm run web:dev
```

Manual browser verification:

```text
Open /intakes and inspect seeded records.
```

---

# Acceptance Criteria

TASK-0011 is complete when:

```text
1. seed:demo script exists.
2. Seed script writes demo data into Postgres.
3. Seed script is safe to run repeatedly without uncontrolled duplicates.
4. Seeded data covers draft, submitted, AI draft, reviewed, Gate 1 approved, and approved + distribution preview states.
5. Seeded records are clearly marked as demo/local data.
6. UI can display seeded records through the API.
7. Runtime smoke covers at least one full AI-assisted workflow through distribution preview.
8. Existing 49 core tests still pass.
9. api:build passes.
10. web:build passes.
11. prisma:generate passes.
12. Existing demos still pass.
13. README documents seed/demo/runtime smoke flow.
14. AI build logs and memory index are updated.
15. No live external integrations are added.
16. No n8n is introduced.
```

---

# Verification Commands

Offline/build verification:

```bash
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp
```

Live runtime verification:

```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo
npm run api:start:dev
```

In another terminal:

```bash
npm run smoke:api
npm run smoke:runtime
npm run web:dev
```

Then open:

```text
http://localhost:3001/intakes
```

---

# Expected Final Report

When TASK-0011 is done, report:

```text
Commit hash
Files changed
Scripts added/updated
Seeded demo records
Smoke tests added/updated
Offline verification results
Live runtime verification results
Manual browser verification notes
Known limitations
Recommended pause/resume point
```

Example:

```text
TASK-0011 done.

Verification:
- npm run check: 49/49 pass
- npm run api:build: pass
- npm run web:build: pass
- npm run prisma:generate: pass
- all 5 demos: pass
- seed:demo: pass
- smoke:api: pass
- smoke:runtime: pass

Seeded records:
- Draft intake
- Submitted intake
- AI draft available intake
- Reviewed package intake
- Gate 1 approved intake
- Approved + distribution preview intake

Known limitations:
- Actor selector remains dev auth shim
- No real AI provider yet
- No live Monday/GitHub integrations yet
```

---

# Agent Execution Prompt

Use this prompt for Claude Code or Codex:

```text
You are working on Project Intake OS.

Implement TASK-0011: End-to-End Runtime Smoke & Seeded Demo Data.

Context:
- TASK-0005 through TASK-0008 completed the backend governance spine:
  AI drafts → Human reviews → Workflow approves → Distribution preview uses ReviewedProjectPackage.
- TASK-0009 stabilized the API runtime.
- TASK-0010 added the minimal Next.js review UI.
- The next goal is to make the project easy to seed, demo, smoke-test, and resume later.
- n8n is intentionally excluded.
- Do not add live external integrations.

Implement:
1. Add a seed:demo script that writes demo data into the Prisma/Postgres runtime.
2. Seed demo intakes covering:
   - draft
   - submitted
   - AI draft available
   - reviewed package available
   - Gate 1 approved
   - approved + distribution preview ready
3. Make seed data idempotent or safely reset only demo records.
4. Preserve audit trail behavior by using application services where practical.
5. Add or extend runtime smoke testing to verify a full API workflow through reviewed package, approvals, and distribution preview.
6. Ensure seeded data appears in the Next.js UI.
7. Update README with seed/demo/runtime instructions.
8. Update task docs and AI build logs.

Do not implement:
- live AI provider integration
- Google SSO
- n8n
- Monday live creation
- GitHub live provisioning
- AWS deployment
- frontend redesign

Verification:
Run offline:
npm run check
npm run api:build
npm run web:build
npm run prisma:generate
npm run demo:analysis
npm run demo:analysis-review
npm run demo:review-guard
npm run demo:reviewed-distribution
npm run demo:mvp

Run live:
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo
npm run api:start:dev
npm run smoke:api
npm run smoke:runtime
npm run web:dev

Manual:
Open http://localhost:3001/intakes and confirm seeded demo records appear across workflow stages.

Return:
- files changed
- scripts added/updated
- seeded record summary
- verification results
- known limitations
- recommended pause/resume point
```

---

# Pause / Resume Note

After TASK-0011, this is a very clean pause point.

At that point, the project has:

```text
governed backend workflow
stable API runtime
minimal browser UI
seeded demo data
runtime smoke testing
clear README setup
```

Recommended resume tasks later:

```text
TASK-0012 — Real AI provider adapter behind the existing draft contract
TASK-0013 — Team roster API integration and assignment scoring
TASK-0014 — Monday board mapping/config preview
TASK-0015 — GitHub provisioning adapter mock/live split
```

Do not start TASK-0012 until the current MVP is easy to run and demo locally.
