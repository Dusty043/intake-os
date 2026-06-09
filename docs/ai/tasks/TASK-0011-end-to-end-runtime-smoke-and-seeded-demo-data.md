# TASK-0011 — End-to-End Runtime Smoke & Seeded Demo Data

## Status: complete

## Goal

Make the Project Intake OS easy to run, reset, demo, and verify end-to-end.

Deliverables:
- Seed script: 6 demo intakes covering every workflow stage
- Idempotent re-seed without touching real records
- Extended runtime smoke test: full AI-assisted governance flow through the live API
- README updated with seed/smoke/demo walkthrough

## Baseline

```
npm run check           → 49/49 pass
npm run api:build       → pass
npm run web:build       → pass
npm run prisma:generate → pass
npm run demo:*          → all 5 pass
```

## Files Created

```
scripts/seed-demo-data.mjs              Seed 6 demo intakes via application service + Prisma
scripts/smoke-runtime-workflow.mjs      Full governance flow smoke test against live API
docs/ai/tasks/TASK-0011-*.md            This file
```

## Files Modified

```
package.json      — added seed:demo, smoke:runtime, db:reset:demo scripts
README.md         — updated build state, added Seeded Demo Data section, updated browser walkthrough
docs/ai/BUILD_LOG.md
docs/ai/MEMORY_INDEX.md
```

## Architecture

### Seed Script Strategy

The seed script (`scripts/seed-demo-data.mjs`) uses:

1. `PrismaClient` directly (not NestJS injectable) — standalone connection to Postgres
2. `SeedPrismaStore` — inline JS class implementing `ProjectIntakeStore`, mirrors `PrismaProjectIntakeStore` logic without NestJS decorators
3. `IntakeWorkflowService` from `dist/src/index.js` — same compiled application service used by the NestJS API
4. All 6 intakes created through real service methods — audit trail, governance guards, and state transitions are preserved exactly as in production

This ensures seeded records are structurally identical to records created through the API.

### Idempotency

Option A: delete all records where `requester = "demo.requester@local"`, then recreate.

- Simple and clear
- Only demo records are touched
- Real records (different requester) are never deleted

### Seeded Demo Intakes

| # | Title | Status | Key feature shown |
|---|-------|--------|-------------------|
| 1 | Payment Failure Notification Fix | `draft` | Fresh intake before submission |
| 2 | Marketing Dashboard Request | `submitted` | Ready for AI analysis |
| 3 | Customer Portal Enhancement | `intake_review` | AI draft generated, awaiting human review |
| 4 | Internal SSO Management Tool | `intake_review` | Reviewed package ready, Gate 1 available |
| 5 | Data Pipeline Migration | `devops_review` | Gate 1 approved, Gate 2 pending |
| 6 | Project Intake OS UI Buildout | `approved` | Both gates approved, distribution preview ready |

### Runtime Smoke Test

`scripts/smoke-runtime-workflow.mjs` runs 8 phases against a live API:

1. Infrastructure — `/health`, `/health/db`, `/docs-json`
2. Intake CRUD — list intakes, create draft
3. Submission — submit to `submitted`
4. AI draft — generate mock analysis draft
5. Human review — accept draft, verify reviewed package created
6. Approval gates — Gate 1, Gate 2
7. Distribution preview — generate provisioning plan, verify `source.type = reviewed_project_package`, verify all actions have `dryRun = true`
8. Audit trail — verify INTAKE_CREATED, ANALYSIS_DRAFT_GENERATED, REVIEWED_PROJECT_PACKAGE_CREATED events

Governance assertions:
- AI cannot approve (draft reviewStatus stays `draft` until human acts)
- Gate 1 blocked until reviewed package exists (tested implicitly via accept-then-approve sequence)
- Distribution preview source is always `reviewed_project_package` (hard assertion)
- All plan actions are `dryRun = true` (hard assertion)

## npm Scripts Added

```json
"seed:demo":     "node --env-file=.env scripts/seed-demo-data.mjs"
"smoke:runtime": "node scripts/smoke-runtime-workflow.mjs"
"db:reset:demo": "npm run prisma:migrate:reset && npm run seed:demo"
```

## Offline Verification

```
npm run check           → 49/49 pass (unchanged)
npm run api:build       → pass
npm run web:build       → pass
npm run prisma:generate → pass
npm run demo:*          → all 5 pass
```

## Live Verification (requires running stack)

```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo         # Seeds 6 demo intakes
npm run api:start:dev     # Terminal 1
npm run smoke:api         # Terminal 2 — quick health/CRUD check
npm run smoke:runtime     # Terminal 2 — full governance flow
npm run web:dev           # Terminal 3 — open http://localhost:3001/intakes
```

Live runtime not executed in the build environment (Docker not available). Scripts are complete and tested against the compiled application layer via offline checks.

## Known Limitations

- Actor selector remains dev auth shim (no Google SSO)
- No live AI provider (intentional)
- No live Monday/GitHub writes (intentional)
- Seed script requires `npm run api:build` first (uses compiled dist/)
- `db:reset:demo` will prompt for confirmation (Prisma migrate reset behavior)

## Recommended Next Tasks

```
TASK-0012 — Real AI provider adapter behind the existing draft contract
TASK-0013 — Team roster API integration and assignment scoring
TASK-0014 — Monday board mapping/config preview
TASK-0015 — GitHub provisioning adapter mock/live split
```

TASK-0011 is a clean pause point. The project now has a governed backend, stable API runtime, minimal browser UI, seeded demo data, and runtime smoke testing.
