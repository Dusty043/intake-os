# Project Memory

## Current System State (updated TASK-0040, 2026-07-02)

The repository began as a product/specification package (TASK-0001, domain-only). It is now a
running application. This section replaces the previous "nothing exists yet" snapshot, which was
badly stale — see `docs/ai/BUILD_LOG.md` for the full task-by-task history.

**Built and running:**
- Postgres persistence via Prisma (real migrations exist under `apps/api/prisma/migrations/`)
- NestJS API (`apps/api/src`) + Next.js 15 review UI (`apps/web/src`)
- Full intake lifecycle: create → submit → AI draft → human review → Gate 1 → Gate 2 →
  distribution preview → provisioning execution → retry → post-distribution lifecycle
- Discovery Engine (ambiguity resolution before intake) — mock agents by default, real
  OpenAI/Anthropic/Bedrock agents via `AI_PROVIDER`
- AI evaluation orchestrator (mock agents by default; `ANALYSIS_ENGINE=orchestrator` for the
  multi-agent pipeline)
- Google OAuth (`AUTH_MODE=google`), with `dev_headers` mode for local/demo use
- Rate limiting (global + per-route tiers)
- AI cost governance and usage dashboard (`/admin/ai-usage`)
- Outbound Google Chat notifications (env-gated on `GOOGLE_CHAT_WEBHOOK_URL`)
- Roster API client + developer-assignment scoring (env-gated on `ROSTER_API_URL`/`ROSTER_API_KEY`)
- Scheduled background retry for provisioning targets (TASK-0039 Part 3) — auto-retry backoff
  runs as a detached continuation instead of blocking the caller

**Built, mock-only (no live external write path):**
- Provisioning execution only has mock Monday/GitHub executors
  (`src/application/provisioning/mock-executor.ts`). There is no real `MondayProvisioningExecutor`
  or GitHub provisioning executor.

**Spec-ready, not implemented in code:**
- Monday live adapter (`docs/ai/tasks/TASK-0023D-monday-adapter.md`)
- GitHub live adapter (`docs/ai/tasks/TASK-0023E-github-adapter.md`)
- Inbound email intake, `/intake-sources/email` (`docs/ai/tasks/TASK-0025-email-intake.md`)
- Google Chat slash-command intake, `/intake-sources/chat` (`docs/ai/tasks/TASK-0026-google-chat-intake.md`)

Do not assume any of the four items above exist just because a task doc or README mention exists
for them — check for the actual controller route or executor class first. This exact
docs-vs-code mismatch was the reason TASK-0040 (hardening pass) happened.

## Architecture Direction

Domain-first and framework-neutral at the core (`src/domain`, `src/application`) so the NestJS
API and any future runtime can add persistence, routes, and UI without duplicating product logic.
This held up as intended — the API and Prisma layers were added later without rewriting the
domain/application layers.

## Product Principle

The app owns the boundary. Monday and GitHub distribute the work. Developers own implementation.
The app does not become a deep bidirectional sync engine with either downstream system.

## Known Gaps (as of TASK-0040)

- `PrismaProjectIntakeStore.saveIntake` writes `ProvisioningPlan` relationally as of TASK-0039
  Part 4 — before that fix, every real (non-in-memory) distribution execution failed with a
  foreign-key violation. Worth re-verifying if this file is read again and that fix looks old.
- No automated Prisma-integration tests exist — nothing in `npm test` connects to a real Postgres
  instance. Bugs specific to the Prisma store (like the one above) are only caught by manual/live
  verification.
- Discovery API routes use inline body shapes, not DTOs with `class-validator` — see TASK-0040
  Slice D for the hardening status of this.
