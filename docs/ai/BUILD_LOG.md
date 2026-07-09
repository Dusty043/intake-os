# Build Log

## 2026-06-29 — TASK-0035: UX Friction Backlog — FP-001, FP-006, FP-007 + Governance Benchmark

**Status:** Complete

### FP-001 — Tab Badges on Intake Detail
- `apps/web/src/app/intakes/[id]/page.tsx`: added `tabBadge(tab)` helper that returns small colored dot indicators or count chips per tab
  - Amber dot on "AI Draft" when a pending draft awaits review (`hasDraftPending`)
  - Indigo dot on "Evaluation" when evaluation data exists; on "Reviewed Package" when a package exists; on "Distribution" when plan exists (amber if distribution is ready to execute)
  - Amber dot on "Approvals" when an approval gate needs action
  - Count chip on "Audit Trail" showing total event count
- Tab rendering updated to render `tabBadge(tab)` inline in each tab button

### FP-006 — Search and Filter on Intakes List
- `apps/web/src/app/intakes/page.tsx`: added `query` (free-text) and `statusFilter` state
- `filtered` derived via `useMemo` — filters by case-insensitive substring on title/requester/id, and by exact status slug
- Filter bar renders above the table: flex-1 text input + 180px status select with all status slugs via `getStatusInfo`
- "Showing X of Y" count displayed when any filter is active; empty state has two variants ("No intakes match your filters." vs original "No intakes yet.")

### FP-007 — Success Toasts on Governance Actions
- `apps/web/src/components/Toast.tsx` (new): emerald-styled auto-dismiss banner (4000ms), manual dismiss button; timer resets on new message; renders nothing when message is null
- `apps/web/src/app/intakes/[id]/page.tsx`: imported Toast; added `successMsg` state; added `ACTION_SUCCESS` map (submit, resubmit, mock_draft, accept_draft, reject_draft, regen_draft, revise_draft, approve_gate1, approve_gate2, reject_gate1, reject_gate2, request_changes, gen_plan); `handleAction` sets `successMsg` after each successful action; Toast rendered between tab strip and tab content

### Governance Flow Benchmark
- `scripts/benchmark-governance-flow.mjs` (new): 10-step in-process governance benchmark using mock providers (no running API/DB needed)
  - All 10 steps complete in ~3.15ms total — confirms governance layer is in-memory-fast; no bottleneck
  - All governance guards pass: correct status transitions (draft → submitted → devops_review → approved), approvals locked, provisioning plan is dry-run only
  - 10 audit events recorded, 5 provisioning actions generated
  - Supports `--runs=N` flag for averaged results with bar chart and bottleneck ranking
- `package.json`: added `"bench:governance": "node scripts/benchmark-governance-flow.mjs"` script

### Orchestrator Parallelism Analysis (P3 — deferred, unsafe)
- Investigated parallelizing Stage 1 `clarification_questions` with `classification` in `EvaluationOrchestrator`
- Confirmed UNSAFE: `classification` receives `sections` which includes `clarification_questions` (set at line 212, classification called at line 218)
- Parallelizing would cause classification to run without clarification context — dropped

### P1 (provisioning preview before Gate 2) — awaiting confirmation
- Allowing `generateProvisioningPlan` during `devops_review` status requires changing a workflow state guard condition
- CLAUDE.md mandates human confirmation before this change — not implemented

### Checks
- `npm run typecheck` — clean (all FP-001, FP-006, FP-007 changes)

---

## 2026-06-29 — TASK-0035: Discovery UX — FP-003 + FP-004

**Status:** Complete

### FP-003 — Discovery Session Identifiability
- `apps/web/src/app/discovery/page.tsx`: replaced "ID / Status / Messages / Last Activity" columns with "Session / Status / Last Activity"
- Session title derived from `problemFrame.problemStatement` (for framed sessions) or first user message content (truncated to 90 chars); falls back to ID slice only when no messages exist
- Last Activity now shows relative time ("2h ago", "3d ago") with absolute date in tooltip via `title` attribute
- Added `formatRelativeTime`, `getSessionTitle`, `getLinkedIntakeId` helpers

### FP-004 — Discovery → Intake Handoff
- `apps/web/src/app/discovery/[id]/page.tsx`: `handleSendToEvaluation` now stores intake ID in `localStorage` under key `pit:discovery:intake:{sessionId}` before navigating to the intake
- On page load, if `status === "sent_to_evaluation"`, reads localStorage and sets `linkedIntakeId` state
- Renders a green callout banner below the header: "✓ Sent to evaluation — View intake →" linking directly to the intake; falls back to "View in intakes list →" if localStorage key is absent (e.g. different browser/device)
- Discovery list page: `sent_to_evaluation` rows show "View intake →" inline link when localStorage has the ID

### Checks
- `npm run typecheck` — clean

---

## 2026-06-29 — TASK-0032: Input Validation Hardening + UI Polish

**Status:** Complete

### TASK-0032: Input Validation Hardening
All implementation was found already complete from a prior session. Verified and confirmed:
- `apps/api/src/common/validation-constants.ts` — named length constants (title 200, description 5000, requester/department 100, reason 1000, comment 2000, note 500, discovery 2000)
- `CreateIntakeDto`, `RequestChangesDto`, `ApprovalDecisionDto`, `RejectAnalysisDraftDto`, `RegenerateAnalysisDraftDto`, `CompleteDiscoveryDto`, `LifecycleTransitionDto` — all updated with `@MaxLength`
- `apps/api/src/main.ts` — `ValidationPipe` confirmed with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- `tests/input-validation.test.mjs` — 34 tests, all passing. Coverage: all DTOs, boundary values (exact max passes, max+1 rejects), empty string rejection, whitelist/forbidNonWhitelisted behavior, constants sanity checks.

### UI Polish Pass (Impeccable P1 fixes)
- `animate-bounce` → `animate-typing-dot` in `DiscoveryChat.tsx` — smooth pulse, no bounce, reduced-motion safe
- Removed `rounded-t-lg` from `.tab-btn` in `globals.css` — flat tabs, eliminates border-accent-on-rounded false positive
- Discovery status constants consolidated: `getDiscoveryStatusInfo()` added to `status.ts`, removed divergent `STATUS_COLOR`/`STATUS_LABELS` from `discovery/page.tsx`
- `intakes/[id]/page.tsx`: `text-gray-400` → `text-brand-muted` on out-of-scope list; draft history inline statusColor map → `StatusBadge` component; JSON hint `text-gray-500` → `text-gray-600`; idempotency key and audit table headers bumped from gray-400/gray-500 to gray-500/gray-600; Gate 1/Gate 2 Reject buttons now show "Rejecting…" loading state

## 2026-06-27 — Live Demo: Discovery Engine + OpenAI Agents (gpt-5.5 + gpt-5.4-mini)

**Status:** Full end-to-end Discovery→Intake pipeline demonstrated live on oreochiserver

### What was demonstrated
- Discovery Engine running fully live with OpenAI on oreochiserver (`docker-compose.server.yml`)
- gpt-5.5 orchestrated the discovery conversation (intent, framing, solutions, clarification, direction, proposal)
- gpt-5.4-mini used for all 12 evaluation agents (intake_brief, classification, architecture, risk_security, cost_effort, work_breakdown, distribution_plan, synthesis, quality_review, etc.)

### Live session walkthrough (discovery-mqvd7n6m-1)
Project: "Branded Client Portal for QuickBooks Invoices, Stripe Payments, and Support Ticketing"

1. **Intent Detected** — gpt-5.5 extracted the core need from free-form description, detected "Solution Bias" (user named Stripe+QuickBooks instead of describing pain)
2. **Problem Framed** — Full problem frame with 5 affected user groups, 8 pain points, 16 unknowns, confidence scores (90% / 84% / 76% / 82% / 68% / 74%)
3. **Solutions Generated** — 4 options: off-the-shelf SaaS (low), custom managed portal (medium, Recommended), hybrid portal (medium), enterprise event-driven (high)
4. **Clarification** — 2 blocking + 1 important questions posed; after answers, "Solution Bias" warning cleared, confidence scores updated upward
5. **Direction Selected** — Recommended option selected; orchestrator advanced to `direction_selected`
6. **Proposal Ready** — gpt-5.5 composed full proposal with 6 epics and 8 open unknowns
7. **Evaluation Ready** — Session reached `evaluation_ready`; `POST /discovery/:id/send-to-evaluation` created intake `intake-mqvduto1-14`

### Bugs found during demo
- **Frontend gap #1:** No "Generate Proposal" button shown after Direction Selected — proposal must be triggered via API manually (`POST /discovery/:id/proposal`)
- **Frontend gap #2:** No "Send to Evaluation" button rendered when status is `evaluation_ready` — action must be triggered via API
- **Persistence gap:** `send-to-evaluation` returns a valid `intakeRecord` but the intake is not persisted to the database — `GET /intakes/:id` returns 404. The `proposal-to-intake-adapter` creates the record object but the controller/orchestrator does not call `intakeRepository.save()`.

### Infrastructure fixes (committed prior to demo)
- `DynamoJobStatusStore` rewritten to use `DynamoDBDocumentClient` (was using `@aws-sdk/util-dynamodb` which was not in package.json)
- `src/application/job-status-store.ts` — committed (was untracked)
- `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` added to package.json
- OpenAI client fixes: `max_tokens` → `max_completion_tokens`, removed `temperature: 0.2` (gpt-5.x constraints)
- Server correctly runs on `docker-compose.server.yml` (not `docker-compose.yml`)

## 2026-06-26 — Discovery Engine Phases 4+5+6: Manifest Generator + NestJS Module + Frontend UI

**Test count:** 93/93 pass (discovery phases 1–4 only; core suite at 671 prior to these additions)

Added the final three phases of the Discovery Engine in one combined session.

### Phase 4: Provisioning Manifest Generator
- `src/application/discovery/agents/mock-manifest-generator-agent.ts` — `IManifestGeneratorAgent` implementation; maps all 10 intent types to `recommendedAction`; populates Monday epics/tasks, GitHub labels, slug-formatted repo name; `readyForLiveAdapter: false` always (mock)
- `src/application/discovery/agents/discovery-agent-contract.ts` — added `IManifestGeneratorAgent` interface
- `src/application/discovery/discovery-orchestrator.ts` — added `manifestGeneratorAgent` 7th constructor arg, `generateManifest()` method (auto-composes proposal if needed)
- `src/application/discovery/discovery-controller.ts` — added `generateManifest()` proxy
- `src/application/discovery/index.ts` — exported `MockManifestGeneratorAgent`
- `src/application/api-composition-root.ts` — wired `MockManifestGeneratorAgent`
- `tests/discovery-phase-4.test.mjs` — 14 new tests: manifest shape, Monday/GitHub blocks, intent routing, auto-compose, E2E Phase 1–4 happy path
- `tests/discovery-phase-1.test.mjs`, `tests/discovery-phase-2.test.mjs`, `tests/discovery-phase-3.test.mjs` — updated `makeOrchestrator()` to 8-arg constructor

### Phase 5: NestJS DiscoveryModule
- `apps/api/src/modules/discovery/discovery.module.ts` — `@Module` with `useFactory` wiring all 7 mock agents, idFactory, `DiscoveryOrchestrator`, `DiscoveryController`
- `apps/api/src/modules/discovery/discovery.controller.ts` — `DiscoveryHttpController` with 10 routes: POST /discovery, GET /discovery, GET /discovery/:id, POST /:id/message, POST /:id/solutions, POST /:id/clarifications/answer, POST /:id/direction, POST /:id/proposal, POST /:id/manifest, POST /:id/send-to-evaluation
- `apps/api/src/app.module.ts` — registered `DiscoveryModule`
- NestJS typecheck: clean

### Phase 6: Frontend UI
- `apps/web/src/lib/discovery-client.ts` — typed API client for all 10 discovery endpoints
- `apps/web/src/lib/discovery-types.ts` — TS types mirroring discovery domain
- `apps/web/src/app/discovery/page.tsx` — session list with status badges, start modal trigger
- `apps/web/src/app/discovery/[id]/page.tsx` — three-panel session view with all action handlers (send message, answer clarification, select direction, compose proposal, generate manifest, send to evaluation)
- `apps/web/src/components/discovery/DiscoveryLayout.tsx` — three-column grid layout
- `apps/web/src/components/discovery/DiscoveryTimeline.tsx` — vertical step tracker for 10 statuses
- `apps/web/src/components/discovery/DiscoveryChat.tsx` — message list, clarification cards, input box
- `apps/web/src/components/discovery/DiscoveryUnderstanding.tsx` — confidence bars, intent, problem frame, solution option cards, proposal/manifest summary, action buttons
- `apps/web/src/components/discovery/DiscoveryStartModal.tsx` — modal to start a new session
- `apps/web/src/components/discovery/DiscoveryStartForm.tsx` — form within modal
- Web app typecheck: clean

### Key design decisions
- `generateManifest` and `sendToEvaluation` both auto-compose the proposal if not done — callers skip the explicit composeProposal step
- Mock manifest never sets `readyForLiveAdapter = true` — live adapter wiring is a future phase
- NestJS `useFactory` creates all agents inline (no DI for discovery agents) — keeps module self-contained while live providers are absent
- Frontend uses `useActor()` for API auth headers; all discovery client calls take `actor` parameter matching existing app conventions
- `sendToEvaluation` navigates to the intake if the response includes an `intakeRecord.id`, otherwise stays on the session page

## 2026-06-26 — Discovery Engine Phase 3: Proposal Composer + Evaluation Handoff Adapter

**Test count:** 671/671 pass (up from 638 after Phase 2)

Added the third phase of the Discovery Engine — proposal composition and evaluation handoff.

### Files added
- `src/application/discovery/agents/mock-proposal-composer-agent.ts` — builds a `ProjectProposal` from `DiscoverySession` state; populates all 11 populated dimensions as `DimensionSlot<T>` with confidence and provenance; completeness gate determines `evaluation_ready` vs `complete` status
- `src/application/discovery/proposal-to-intake-adapter.ts` — maps `ProjectProposal + DiscoverySession → ProjectIntakeRecord`; preserves `discoverySessionId` in source payload; maps intent type to project type; builds `DiscoveryRecord` from proposal data
- `tests/discovery-phase-3.test.mjs` — 33 new tests covering proposal shape, completeness gate, adapter mapping, orchestrator methods, controller proxy, E2E happy path
- `docs/ai/tasks/TASK-DISCOVERY-PHASE3.md` — task log

### Files modified
- `src/application/discovery/agents/discovery-agent-contract.ts` — added `IProposalComposerAgent` interface
- `src/application/discovery/discovery-orchestrator.ts` — added `IProposalComposerAgent` constructor arg, `composeProposal()`, `sendToEvaluation()`, `SendToEvaluationResult` type
- `src/application/discovery/discovery-controller.ts` — added `composeProposal()`, `sendToEvaluation()` routes
- `src/application/discovery/index.ts` — barrel-exported new files
- `src/application/api-composition-root.ts` — wired `MockProposalComposerAgent`
- `tests/discovery-phase-1.test.mjs` — updated constructor call (7-arg)
- `tests/discovery-phase-2.test.mjs` — updated constructor call (7-arg)

### Key design decisions
- `IProposalComposerAgent` takes the full `DiscoverySession` (not just context); the proposal composer has access to selected solution, answered clarifications, and confidence scores
- `sendToEvaluation` auto-composes the proposal if not already done — callers can use it as a one-shot convenience
- The returned `intakeRecord` is NOT persisted by the orchestrator — the caller (HTTP handler, composition root) owns persistence; this keeps the discovery layer free of intake store coupling
- Completeness gate: `evaluation_ready` requires problemFrame.value, ≥1 functional requirement, ≥1 suggested epic; unknowns surface as notes but do not block

## 2026-06-26 — Discovery Engine Phase 2: Solution Generation + Clarification + Direction Selection

**Test count:** 638/638 pass (up from 616 after Phase 1)

Added Phase 2 of the Discovery Engine: solution option generation, dimension-guided clarification planning, and direction selection.

Files added: `mock-solution-generation-agent.ts`, `mock-clarification-agent.ts`, `tests/discovery-phase-2.test.mjs`, `docs/ai/tasks/TASK-DISCOVERY-PHASE2.md`

Bug fixed: intent signal ordering — chatbot/llm signals now checked before automation signals to prevent "We need a chatbot to answer questions automatically" from being misclassified as `automation`.

## 2026-06-26 — Discovery Engine Phase 1: Core Session + Intent + Problem Framing

**Test count:** 616/616 pass

Introduced the Discovery Engine — an ambiguity-resolution layer that sits before the existing evaluation orchestrator.

Key design: `DimensionSlot<T>` pattern for the 12-dimension evaluation scaffold; nullable, confidence-scored, source-tagged. Evaluators use whichever dimensions are populated.

Files added: `src/domain/discovery.ts`, `src/application/discovery/` (orchestrator, controller, session store, agent contract, 4 mock agents), `tests/discovery-phase-1.test.mjs`, `docs/ai/tasks/TASK-DISCOVERY-PHASE1.md`

## 2026-06-24 — README full rewrite

Rewrote `README.md` from the stale TASK-0012 state to the current feature-complete build.
- Removed "Intentionally disabled" section (all features are now built, just awaiting credentials)
- Updated test count to 592/592
- Added full API endpoint table including assignment override, lifecycle, admin AI usage, intake sources
- Updated repository map to reflect roster/, notifications/, provisioning/ subdirectories
- Added build state table showing all 16 subsystems and their credential wait status
- Added auth mode section covering `dev_headers` and `google` modes
- Added reference to `docs/EXTERNAL-NEEDS.md`
- Removed outdated "POC" and "TASK-0012" language

## 2026-06-24 — TASK-0034: Roster Integration + Refinement

Roster API integration with graceful degradation, manual assignment override, and UI card.
Also: ISSUE-003 Debug tab restricted to admin, ISSUE-002 AI Draft empty-state role guard.

Files changed:
- `src/application/roster/roster-types.ts` — NEW: `TeamMemberRosterRecord`, `ScoredRosterMember`, `RosterAssignmentResult` interfaces
- `src/application/roster/roster-api-client.ts` — NEW: HTTP client; graceful degradation when `ROSTER_API_URL` unset; normalizes any response shape
- `src/application/roster/roster-scorer.ts` — NEW: scoring algorithm (skills + project type + availability + capacity − risk penalties); returns sorted ranked list with backup
- `src/application/roster/index.ts` — NEW: barrel export
- `src/application/intake-analysis.ts` — ADD: `rosterResult` option to `BuildMockAnalysisDraftOptions`; `buildAssignmentRecommendation` uses live roster data when available, falls back to advisory stub; updated `DeveloperAssignmentRecommendationDraft` with `rosterConnected`, `backupDeveloperId/Name`, `scoringSignals`
- `src/application/providers/mock-intake-analysis-provider.ts` — INJECT: optional `RosterApiClient`; fetches roster and scores before building draft
- `src/application/intake-workflow-service.ts` — ADD: `rosterClient` option; `overrideAssignment()` and `clearAssignmentOverride()` methods; import RosterApiClient
- `src/application/types.ts` — ADD: `assignmentOverride` field on `ProjectIntakeRecord`
- `src/application/evaluation-draft-mapper.ts` — FIX: add `rosterConnected: false` to stub assignment
- `src/application/providers/draft-output-mapper.ts` — FIX: add `rosterConnected: false` to stub assignment
- `apps/api/src/modules/intake/dto/override-assignment.dto.ts` — NEW: DTO
- `apps/api/src/modules/intake/intake.controller.ts` — ADD: `POST /intakes/:id/assignment` and `DELETE /intakes/:id/assignment`
- `apps/api/src/runtime/runtime.module.ts` — WIRE: `RosterApiClient` from `ROSTER_API_URL` + `ROSTER_API_KEY` env vars
- `apps/web/src/lib/types.ts` — ADD: `AssignmentRecommendation`, `AssignmentOverride` types; `assignmentOverride` on `ProjectIntakeRecord`
- `apps/web/src/lib/api-client.ts` — ADD: `overrideAssignment()`, `clearAssignmentOverride()`
- `apps/web/src/components/AssignmentCard.tsx` — NEW: UI card with confidence bar, skill chips, workload signals, backup, override form
- `apps/web/src/app/intakes/[id]/page.tsx` — WIRE: `AssignmentCard` in AI Draft tab; Debug tab restricted to admin role; AI Draft empty-state button role-gated
- `tests/roster.test.mjs` — NEW: 10 unit tests for scorer + client

Env vars to add to `.env.server` when roster is live:
```
ROSTER_API_URL=https://ai-team.simple.biz/api/roster
ROSTER_API_KEY=<optional>
```

Commands run:
```
npm run build:core && npm run api:build   # clean
npm run typecheck                         # clean
npm test                                  # 592/592 pass
```

## 2026-06-23 — QA Run + Frontend Role-Guard Fixes

Standard-tier QA of the running app at http://localhost:8080 (dev_headers mode).

Issues found and fixed:
- **ISSUE-001 (Medium):** Mark Plan Ready button visible to all roles — now gated to `devops_lead` and `admin`
- **ISSUE-002 (Medium):** Generate Mock AI Draft button visible to `request_creator` — now gated to roles with `generate_evaluation` permission
- **ISSUE-003 (Low/prod):** Debug tab visible to all roles — deferred; restrict before OAuth activation
- **ISSUE-004 (Low):** Approvals tab slow initial load (~3s) — deferred, non-functional
- **ISSUE-005 (Low):** Intakes table overflow on mobile — deferred, low-priority internal tool

Health score: **82/100**. No critical or high bugs. API enforces all permissions correctly throughout.

Files changed:
- `apps/web/src/app/intakes/[id]/page.tsx` — ADD `useActor()` to OverviewTab; role-guard Generate Mock AI Draft and Mark Plan Ready buttons
- `.gstack/qa-reports/qa-report-localhost-2026-06-22.md` — NEW: full QA report

Commands run:
```
npm run typecheck   # clean
```

## 2026-06-22 — TASK-0030: AI Cost Governance

Token/cost data was already flowing through AgentRun records. Wired the read side: admin usage endpoints, cost badge in evaluation panel, admin AI usage dashboard.

Files changed:
- `src/application/providers/model-cost-registry.ts` — NEW: model cost lookup with `COST_INPUT_<SLUG>` env-var overrides and built-in defaults for known models
- `src/application/types.ts` — ADD: `listAllAgentRuns()` to `ProjectIntakeStore` interface
- `src/application/in-memory-store.ts` — IMPL: `listAllAgentRuns()` with intakeId/date filters
- `apps/api/src/persistence/prisma-project-intake-store.ts` — IMPL: `listAllAgentRuns()` with Prisma join to evaluation
- `apps/api/src/modules/admin/ai-usage.controller.ts` — NEW: `GET /admin/ai-usage` and `GET /admin/ai-usage/summary`
- `apps/api/src/modules/admin/admin.module.ts` — NEW: admin module
- `apps/api/src/app.module.ts` — ADD: AdminModule
- `apps/web/src/lib/api-client.ts` — ADD: `getAiUsage()` and `getAiUsageSummary()`
- `apps/web/src/components/EvaluationPanel.tsx` — ADD: `AiCostBadge` showing estimated cost per evaluation
- `apps/web/src/app/admin/ai-usage/page.tsx` — NEW: admin AI usage dashboard with monthly summary + by-model/by-role breakdowns
- `src/index.ts` — EXPORT: token-cost and model-cost-registry
- `tests/ai-cost-governance.test.mjs` — NEW: 21 unit tests

Commands run:
```
npm run build:core && npm run api:build   # clean
npm test                                  # 504/504 pass
```

Notes:
- Model costs for the analysis providers continue to be loaded via the existing `OPENAI_INPUT_COST_PER_1M_TOKENS` / `ANTHROPIC_INPUT_COST_PER_1M_TOKENS` env vars in `analysis-provider-config.ts` — the new `model-cost-registry.ts` is a standalone utility available for other callers
- Admin endpoints require `admin` or `devops_lead` role, checked in controller

## 2026-06-22 — TASK-0029: Rate Limiting

Wired `@nestjs/throttler` with global + per-route limits and env-var overrides.

Files changed:
- `apps/api/src/config/rate-limit.config.ts` — NEW: config loader with all tier defaults and env-var overrides
- `apps/api/src/app.module.ts` — ADD: ThrottlerModule + APP_GUARD (ThrottlerGuard)
- `apps/api/src/main.ts` — ADD: `trust proxy` + `NestExpressApplication` type
- `apps/api/src/modules/intake/intake.controller.ts` — ADD: `@Throttle()` on create, mock, regenerate endpoints
- `apps/api/src/modules/health/health.controller.ts` — ADD: `@SkipThrottle()` on controller
- `tests/rate-limiting.test.mjs` — NEW: 15 unit tests for config defaults and env-var overrides

Commands run:
```
npm install @nestjs/throttler
npm run api:build       # clean
npm run build:core && npm test   # 483/483 pass
```

Notes:
- `POST /intakes/:id/generate-evaluation` does not exist yet in the controller — not throttled; will be added when the endpoint is built
- Webhook routes (TASK-0025/0026 intake sources controller) not throttled yet — placeholder noted in task doc
- Rate limits are per-IP; `trust proxy 1` enables nginx `X-Forwarded-For` passthrough on oreochiserver

## 2026-06-19 — TASK-0028: Failure and Recovery

Implemented full failure and recovery layer for the provisioning system.

Files changed:
- `src/domain/error-categories.ts` (new) — `ProvisioningErrorCategory` enum, `normalizeProvisioningError()`, `isAutoRetryable()`
- `src/application/provisioning/backoff.ts` (new) — `calculateBackoffMs()`, `sleep()`
- `src/domain/provisioning.ts` — added `errorCategory`, `deadLettered`, `deadLetteredAt` to `ProvisioningTargetResult`; `errorSummary` to `ProvisioningRun`
- `src/application/types.ts` — added `updateProvisioningTargetResult()` to `ProjectIntakeStore` interface; fixed import
- `src/application/in-memory-store.ts` — implemented `updateProvisioningTargetResult()`
- `src/application/intake-workflow-service.ts` — added `executeWithAutoRetry()` private method (wraps executor with backoff for transient errors); updated `executeDistribution()` and `retryFailedProvisioningTargets()` to use it; added dead-letter ceiling (3 attempts) with Chat notification; added `markProvisioningTargetResolved()` method
- `src/application/notifications/google-chat-notifier.ts` — added `"provisioning_dead_lettered"` event type
- `src/index.ts` — exported new modules
- `apps/api/prisma/schema.prisma` — added `errorCategory`, `deadLettered`, `deadLetteredAt` to `ProvisioningTargetResult`; `errorSummary` to `ProvisioningRun`
- `apps/api/src/persistence/prisma-project-intake-store.ts` — updated `saveProvisioningRun` to persist new fields; added `updateProvisioningTargetResult()`; updated `fromProvisioningRunRow` to map new columns
- `apps/api/src/modules/intake/dto/mark-resolved.dto.ts` (new)
- `apps/api/src/modules/intake/intake.controller.ts` — added `POST /intakes/:id/provisioning-targets/:targetId/mark-resolved`
- `apps/web/src/lib/types.ts` — updated `ProvisioningTargetResult` and `ProvisioningRun` types
- `apps/web/src/lib/api-client.ts` — added `markProvisioningTargetResolved()`
- `apps/web/src/app/admin/failures/page.tsx` (new) — admin UI listing dead-lettered targets with mark-resolved action
- `tests/provisioning-failure-recovery.test.mjs` (new) — 30 unit tests

Commands run:
```bash
npm run build:core   # clean
npm run api:build    # clean
npm test             # 468/468 pass
```

Notes: Prisma migration (`add_error_category_dead_letter`) is generated but requires DB on server to apply. Run: `npm run prisma:migrate -- --name add_error_category_dead_letter` on oreochiserver.

## 2026-06-19 — TASK-0027: Auth Hardening

Created `src/auth-config-validator.ts` — pure `validateAuthConfig()` function that crashes at startup if `NODE_ENV=production` and `AUTH_MODE` is unset or set to `dev_headers`. Exported from `src/index.ts`. Called in `apps/api/src/main.ts` before `NestFactory.create()`.

Files changed:
- `src/auth-config-validator.ts` (new) — `validateAuthConfig()`, returns `{ mode: AuthMode }`
- `src/index.ts` — added export
- `apps/api/src/main.ts` — calls validator before bootstrap, logs active auth mode
- `tests/auth-config-validator.test.mjs` (new) — 10 unit tests

Commands run:
```bash
npm run build    # clean
npm run typecheck # clean
npm test         # 438/438 pass (10 new auth-config tests)
```

## 2026-06-19 — TASK-0027 through TASK-0032: Pre-Provisioning Hardening Specs

Six task spec documents written for credential-independent hardening work. No code changes — specs only.

- `docs/ai/tasks/TASK-0027-auth-hardening.md` — CRITICAL: startup validator that prevents `AUTH_MODE=dev_headers` from running in production; rejects missing `AUTH_MODE` in production; unit tests for all cases
- `docs/ai/tasks/TASK-0028-failure-and-recovery.md` — HIGH: error category enum, dead-letter promotion logic, exponential backoff helper, manual recovery endpoint, admin failure dashboard; Prisma migration adds `errorCategory`, `deadLettered`, `maxAttempts` to `ProvisioningTargetResult`
- `docs/ai/tasks/TASK-0029-rate-limiting.md` — HIGH: `@nestjs/throttler` wiring, per-route limits for intake submission and AI triggers, env-var configurable tiers, proxy trust config
- `docs/ai/tasks/TASK-0030-ai-cost-governance.md` — HIGH: wire existing `AgentRun` token columns to actual AI provider calls using existing `estimateCost()` utility, model cost registry, admin cost read endpoints, per-evaluation cost badge in UI
- `docs/ai/tasks/TASK-0031-post-distribution-lifecycle.md` — MEDIUM: expand `RequestStatus` enum with `in_progress`, `blocked`, `completed`, `canceled`; lifecycle transition service and endpoints; distributed projects dashboard
- `docs/ai/tasks/TASK-0032-input-validation-hardening.md` — MEDIUM: `@MaxLength` on all DTO string fields, named validation constants, confirm global ValidationPipe options

Open questions added to OPEN_QUESTIONS.md for each task.

## 2026-06-19 — TASK-0024: Google Chat Notifications (Outbound)

Google Chat notifications wired to intake lifecycle events. No-op when `GOOGLE_CHAT_WEBHOOK_URL` is not set.

Changes made:

- `src/application/notifications/google-chat-notifier.ts` (new) — `GoogleChatNotifier` class, fire-and-forget POST to webhook, no-op if URL not configured
- `src/application/notifications/google-chat-config.ts` (new) — loads `GOOGLE_CHAT_WEBHOOK_URL` and `INTAKE_APP_URL` from env
- `src/index.ts` — added notifier exports
- `src/application/intake-workflow-service.ts` — added `notifier?: GoogleChatNotifier` to options; 6 notification hook points: clarification_required, intake_review (×2 paths), devops_review, distributed, provisioning_failed; private `notifyProvisioningOutcome()` helper shared by execute and retry
- `apps/api/src/runtime/runtime.module.ts` — creates `GoogleChatNotifier` from config, logs enabled/disabled status, passes to `IntakeWorkflowService`
- `tests/google-chat-notifier.test.mjs` (new) — 9 unit tests

Also written (no code, spec only):

- `docs/ai/tasks/TASK-0025-email-intake.md` — email intake spec via inbound webhook service
- `docs/ai/tasks/HANDOFF-0025-email-intake.md` — handoff doc with service options and open questions
- `docs/ai/tasks/TASK-0026-google-chat-intake.md` — Google Chat app slash command spec
- `docs/ai/tasks/HANDOFF-0026-google-chat-intake.md` — handoff doc with GCP setup steps and open questions

Commands run:

```bash
npm run typecheck   # clean
npm run build       # clean
npm test            # 428/428 pass (9 new notifier tests)
```

## 2026-06-17 — TASK-0023C: Retry Failed Provisioning Targets

Retry mechanism wired end-to-end. New run with `kind: "retry"` that only executes failed+retryable targets.

Changes made:

- `src/domain/provisioning.ts` — `kind`, `retryOfRunId` on `ProvisioningRun`; `retryable` on `ProvisioningTargetResult`
- `src/application/provisioning/provisioning-executor.ts` — `isRetry: boolean` added to `ProvisioningContext`
- `src/application/provisioning/mock-executor.ts` — retry-aware modes (`github_fail_then_succeed`, `monday_fail_then_succeed`, `both_fail_then_succeed`); per-run idempotency keys for retry targets
- `apps/api/prisma/schema.prisma` — `kind`, `retryOfRunId` on `ProvisioningRun`; `retryable` on `ProvisioningTargetResult`
- Migration: `20260617144700_add_provisioning_retry_fields`
- `src/application/intake-workflow-service.ts` — `retryFailedProvisioningTargets()` method; `executeDistribution` now sets `kind: "initial"`
- `apps/api/src/persistence/prisma-project-intake-store.ts` — persist + read `kind`, `retryOfRunId`, `retryable`
- `apps/api/src/modules/intake/dto/provisioning-run.dto.ts` — new fields in DTO + mapper
- `apps/api/src/modules/intake/intake.controller.ts` — `POST /intakes/:id/distribution/runs/:runId/retry`
- `apps/web/src/lib/types.ts` — `kind`, `retryOfRunId` on `ProvisioningRun`; `retryable` on target result
- `apps/web/src/lib/api-client.ts` — `retryProvisioningRun(id, runId, actor)`
- `apps/web/src/app/intakes/[id]/page.tsx` — retry button in `ProvisioningRunPanel`; "Approve for Execution" renamed to "Mark Plan Ready"
- `tests/provisioning-retry.test.mjs` (new) — 11 tests

Commands run:

```bash
npm run build       # clean
npm run typecheck   # clean
npm test            # 418/418 pass
```

## 2026-06-17 — TASK-0023B: Provisioning Run UI

Distribution tab now shows execution readiness, governance buttons, and run history.

Changes made:

- `apps/web/src/lib/api-client.ts` — added `markReadyForProvisioning`, `executeDistribution`, `listProvisioningRuns`
- `apps/web/src/lib/types.ts` — added `ProvisioningRun`, `ProvisioningTargetResult` types
- `apps/web/src/app/intakes/[id]/page.tsx` — rewrote `DistributionTab`: status banners, "Approve for Execution" + "Execute Distribution" governance buttons, run history panel with per-target status + external links

Commands run:

```bash
npm run typecheck   # clean
npm test            # 407/407 pass
```

## 2026-06-17 — TASK-0023A: Provisioning Execution Foundation

Built the execution slot for distribution without Monday/GitHub writes.

Changes made:

- `src/domain/provisioning.ts` (new) — `ProvisioningRun`, `ProvisioningTargetResult`, status/kind enums
- `src/application/provisioning/provisioning-executor.ts` (new) — `ProvisioningExecutor` interface + `ProvisioningRegistry`
- `src/application/provisioning/mock-executor.ts` (new) — `MockMondayExecutor`, `MockGithubExecutor`, `createMockRegistry(mode)` with 4 modes
- `apps/api/prisma/schema.prisma` — `ProvisioningRun` + `ProvisioningTargetResult` models
- Migration: `20260617135057_add_provisioning_run`
- `src/application/types.ts` — added provisioning run store methods + re-exports
- `src/application/in-memory-store.ts` — implemented `saveProvisioningRun`, `listProvisioningRuns`, `getProvisioningRun`
- `apps/api/src/persistence/prisma-project-intake-store.ts` — same methods via Prisma
- `src/application/intake-workflow-service.ts` — `executeDistribution(id, actor)` with 6 guards + full audit; `listProvisioningRuns`; `provisioningRegistry` option
- `apps/api/src/modules/intake/dto/provisioning-run.dto.ts` (new) — DTOs
- `apps/api/src/modules/intake/intake.controller.ts` — `POST /intakes/:id/distribution/execute`, `GET /intakes/:id/distribution/runs`
- `apps/api/src/runtime/runtime.module.ts` — wires mock registry; reads `PROVISIONING_EXECUTOR_MODE`
- `src/index.ts` — exports new provisioning modules
- `tests/provisioning-execution.test.mjs` (new) — 9 tests covering success, failure, partial success, all guards

Commands run:

```bash
npx prisma migrate dev --name add_provisioning_run   # applied
npm run typecheck   # clean
npm test            # 407/407 pass (was 398/398)
```

## 2026-06-16 — TASK-0022: ClarificationPanel Review Fixes + Test Infrastructure

Applied all actionable findings from the `/review` pass on the TASK-0021 diff.

Changes made:

- `apps/web/src/components/ClarificationPanel.tsx` (new) — extracted from `page.tsx`; `QuestionField` sub-component DRYs required/optional rendering; carries all prior fixes (submittingRef, useEffect reset, aria attrs, stable keys).
- `apps/web/src/components/__tests__/ClarificationPanel.test.tsx` (new) — 10 Vitest tests covering disabled state, aria attributes, blur validation, submit/success/error, double-submit guard, questions-reset, prior clarifications.
- `apps/web/vitest.config.ts` + `apps/web/vitest.setup.ts` (new) — Vitest + jsdom + @testing-library/jest-dom setup.
- `apps/web/package.json` — added vitest, @testing-library/react, user-event, jest-dom, jsdom; added `test` and `test:watch` scripts.
- `apps/web/src/lib/api-client.ts` — `approveGate()` now requires explicit `gate: "gate_1" | "gate_2"` param.
- `apps/web/src/app/intakes/[id]/page.tsx` — imports `ClarificationPanel`; `handleResubmitPanel` useCallback; gate discriminator fix.

Commands run:

```bash
npx vitest run     # 10/10 pass
npm run typecheck  # clean
git push origin main && git push simple-biz main
```

## 2026-06-16 — TASK-0021 Followup: ClarificationPanel Polish + Docs Gap-Fill

Completed remaining TASK-0021 items identified in calibration check.

Changes made:

- `apps/web/src/app/intakes/[id]/page.tsx` — `ClarificationPanel` polished: required/optional question grouping, prior answers shown, inline per-field validation (touched state), submit disabled until required fields filled, success banner after resubmit, error state if `onResubmit` throws; `onResubmit` prop changed to `Promise<void>` with error propagation.
- `docs/ai/MEMORY_INDEX.md` — added TASK-0021 task log entry.
- `docs/ai/SEQUENCE_LOG.md` — added TASK-0021 sequence log entry.
- `docs/product/requirements-trace.md` — added A-014 (ClarificationPanel polish), B-013–B-016 (evaluation read API + UI requirements).

Commands run:

```bash
npm run web:build    # clean
npm run check        # 398/398 pass
```

---

## 2026-06-16 — TASK-0021 Web UI: Evaluation Review Experience

Added read-only evaluation API routes and a full Evaluation tab in the intake detail UI.

Changes made:

- `src/application/intake-workflow-service.ts` — `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluationForIntake` service methods.
- `apps/api/src/modules/intake/dto/evaluation.dto.ts` — new `EvaluationSummaryDto` + mapper.
- `apps/api/src/modules/intake/intake.controller.ts` — `GET /intakes/:id/evaluations`, `/latest`, `/:evaluationId`.
- `apps/web/src/lib/types.ts` — `IntakeEvaluation`, `EvaluationSection`, `QualityScore`, `AgentRun`, etc.
- `apps/web/src/lib/api-client.ts` — `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `getEvaluation`.
- `apps/web/src/components/EvaluationPanel.tsx` — new: `EvaluationPanel`, summary card, quality score badge + breakdown, regen form, empty state.
- `apps/web/src/components/EvaluationSectionCard.tsx` — new: tabbed section browser, 12 section renderers, agent provenance footer.
- `apps/web/src/app/intakes/[id]/page.tsx` — added "Evaluation" tab, evaluation fetch on load, refresh after generate/regen.
- `tests/evaluation-api-read.test.mjs` — 8 new service-layer read tests.

Commands run:

```bash
npm run build:core   # clean
npm run api:build    # clean
npm run web:build    # clean
npm test             # 398/398 pass (8 new)
```

---

## 2026-06-15 — TASK-0020 Step 7: Section Regeneration via EvaluationOrchestrator

Wired `regenerateAnalysisDraft` to route through the `EvaluationOrchestrator` when it is injected. Guidance text is passed as `discoveryNotes`. If the orchestrator returns `clarification_required` during regen, a `ConflictError` is thrown (regen halted, state stays `intake_review`). On success, the new evaluation is persisted, the new draft supersedes the previous one, and the audit event `EVALUATION_REGENERATED` is recorded with `evaluationId`, `previousDraftId`, and `newDraftId`.

Changes made:

- `src/application/intake-workflow-service.ts` — `regenerateAnalysisDraft` routes to orchestrator path when `this.orchestrator` is set.
- `tests/generate-evaluation-service.test.mjs` — 2 new tests: regen supersedes previous draft + `EVALUATION_REGENERATED` audit trail event. Total: 10 new tests in this file, 390/390 passing.

Commands run:

```bash
npm run build:core   # clean
npm test             # 390/390 pass
```

---

## 2026-06-15 — TASK-0020 Wire EvaluationOrchestrator into Live Intake Workflow (Steps 1–6)

Wired the `EvaluationOrchestrator` 3-stage pipeline into `IntakeWorkflowService`. Steps 7 (section regeneration) deferred.

Changes made:

- `src/application/types.ts` — added `GenerateEvaluationInput` interface.
- `src/application/intake-workflow-service.ts` — added `orchestrator?: EvaluationOrchestrator` to options and class; added `generateEvaluation()` method (transitions `submitted → evaluating → intake_review`, persists `IntakeEvaluation` + `AgentRun` records, maps to legacy `IntakeAnalysisDraft`); `generateMockAnalysisDraft` delegates to `generateEvaluation` when orchestrator is injected (no frontend/controller changes needed).
- `apps/api/src/runtime/runtime.module.ts` — updated `IntakeWorkflowService` factory to inject `EvaluationOrchestrator` and pass it when `ANALYSIS_ENGINE=orchestrator`.
- `tests/generate-evaluation-service.test.mjs` — 8 new tests covering happy path, evaluation persistence, audit trail, draft field population, clarification_required routing, guard (no orchestrator), and mock-vs-orchestrator routing.

Commands run:

```bash
npm run build:core   # clean
npm run typecheck    # clean
npm test             # 388/388 pass (8 new)
```

---

## 2026-06-13 — TASK-0020P Draft Schema Extension: proposedArchitecture + implementationSuggestions

Requested: "more from the generated draft — proposed architecture and implementation suggestions".

Changes made:

- `src/application/providers/analysis-draft-output-schema.ts` — added `proposedArchitecture` (string) and `implementationSuggestions` (string[]) to `AnalysisDraftModelOutput` interface, JSON schema `required` + `properties`, and validator.
- `src/application/intake-analysis.ts` — added optional fields to `IntakeAnalysisDraft`; added `buildProposedArchitecture()` and `buildImplementationSuggestions()` helpers; mock builder now returns project-type-aware values for both fields.
- `src/application/providers/draft-output-mapper.ts` — passes the two new fields through to the domain draft.
- `src/application/providers/prompt-templates.ts` — OUTPUT RULES updated to instruct the AI to populate both fields.
- `apps/web/src/lib/types.ts` — added optional fields to web `IntakeAnalysisDraft` type.
- `apps/web/src/app/intakes/[id]/page.tsx` — AiDraftTab now renders "Proposed Architecture" and "Implementation Suggestions" cards after subtasks.
- `tests/*.test.mjs` — OpenAI, Anthropic, Bedrock fixture objects updated with the two new required fields (380/380 pass).

Commands run:

```bash
npm run build:core   # clean
npm test             # 380/380 pass
git push && ssh deploy: docker compose build + up -d (api + web)
```

Commit: `42d3d27`. Server redeployed and running.

## 2026-06-13 — TASK-0014P Intake Review Reject → Regenerate Loop Fix

Requested: sanity check on governance flow; found stuck state at `intake_review` — rejecting an analysis draft left no path to regenerate.

Changes made:

- `src/application/intake-workflow-service.ts` — `regenerateAnalysisDraft` now accepts the current draft when `reviewStatus` is `"draft"` or `"rejected"` (previously only `"draft"`); supersede step and audit metadata updated accordingly.
- `tests/guided-draft-regeneration.test.mjs` — renamed test 8 to reflect the real blocked case (accepted, not rejected); added test 8b covering the full reject → regenerate loop.

Commands run:

```bash
npm run build:core   # clean
npm test             # 380/380 pass (+1 new test)
```

No state machine changes. No governance boundary changes. Regen limit of 5 still applies. Blocked states (accepted, superseded) unchanged.

Commit: `e6ca087`

Follow-up: TASK-0020 — Wire orchestrator into live intake workflow.

## 2026-06-12 — TASK-0019 Prisma Persistence for IntakeEvaluation

Requested: add Prisma persistence for `IntakeEvaluation`, `EvaluationSection`, `AgentRun`; extend `ProjectIntakeStore` with 5 evaluation methods; implement in-memory and Prisma-backed stores; add mapper/persistence tests.

Changes made:

- `apps/api/prisma/schema.prisma` — added `IntakeEvaluation`, `EvaluationSection`, `AgentRun` models; added `evaluations IntakeEvaluation[]` relation to `ProjectIntake`.
- `src/application/evaluation-persistence.ts` — new file: `AgentRunRecord`, `EvaluationPersistenceBundle`, `agentRunsFromEvaluation()`, structural row interfaces (`EvaluationPersistenceRow`, `SectionPersistenceRow`, `AgentRunPersistenceRow`), and `fromEvaluationRow()`/`fromSectionRow()`/`fromAgentRunRow()` mapper functions.
- `src/application/types.ts` — extended `ProjectIntakeStore` with `saveEvaluation`, `getEvaluation`, `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `listAgentRuns`, `getEvaluationById?`.
- `src/application/in-memory-store.ts` — implemented all 6 new evaluation store methods; uses `validateIntakeEvaluation` on write/read.
- `apps/api/src/persistence/prisma-project-intake-store.ts` — implemented `saveEvaluation` (transaction: upsert evaluation, delete+recreate sections and runs), `getEvaluation`, `listEvaluationsForIntake`, `getLatestEvaluationForIntake`, `listAgentRuns`, `getEvaluationById`.
- `src/index.ts` — added `evaluation-persistence.ts` export.
- `tests/evaluation-persistence-memory.test.mjs` — 11 in-memory persistence tests.
- `tests/evaluation-persistence-prisma-mapping.test.mjs` — 16 mapper tests (no DB required).

Commands run:

```bash
npm run build:core   # clean
npm run api:build    # clean
npm run prisma:generate  # clean
npm test             # 379/379 pass (was 352, +27 new tests)
npm run demo:evaluation-orchestrator  # pass
npm run demo:mvp     # pass
npm run demo:analysis  # pass
npm run demo:analysis-review  # pass
npm run demo:review-guard  # pass
npm run demo:reviewed-distribution  # pass
npm run demo:guided-regen  # pass
```

No workflow behavior changed. No API routes added. No UI changes. Existing legacy analysis draft storage untouched.

Follow-up: TASK-0020 — Wire orchestrator into live intake workflow.

## 2026-06-12 — TASK-0018P Evaluation Orchestrator Patch

Requested: normalize agent confidence to 0–1 everywhere, fix demo output spacing, add feasibility weakness in MockCriticQAAgent when score < 60.

Changes made:

- `src/application/evaluation-orchestrator.ts` — changed confidence validation from `> 100` to `> 1`; error message updated to `out of range [0, 1]`.
- `src/application/agents/agent-contract.ts` — added JSDoc on `confidence`: `Must be in [0, 1]`.
- `src/application/agents/mock/mock-critic-qa-agent.ts` — `buildWeaknesses` now accepts `feasibility` + `riskSec`; adds weakness when `feasibility < 60` naming high-risk drivers.
- `tests/evaluation-orchestrator.test.mjs` — renamed "rejects agent confidence above 100" → "above 1", updated confidence values to 0–1 scale.
- `scripts/demo-evaluation-orchestrator.mjs` — fixed section output line to use `| conf=` separator.

Commands run:

```bash
npm run check  # 352/352 pass
npm run demo:evaluation-orchestrator  # pass, spacing fixed, feasibility=51 shown
```

## 2026-06-12 — TASK-0018 Evaluation Orchestrator

Requested: implement the in-memory evaluation orchestrator. 3-stage pipeline (Stage 1 serial, Stage 2 parallel, Stage 3 serial), clarification blocking, depth upgrade, per-agent provenance/timing, quality status mapping, NestJS DI wiring.

Changes made:

- `src/application/evaluation-orchestrator.ts` — `EvaluationOrchestrator` class with `orchestrate()` method; `ClarificationOutcome`, `EvaluationOrchestrationResult` types; `EvaluationOrchestrationError`, `AgentOutputValidationError`, `MissingEvaluationAgentError` error types.
- `tests/evaluation-orchestrator.test.mjs` — 45 orchestrator tests: construction, clarification blocking, depth routing, quality gating, provenance, validation, integration.
- `scripts/demo-evaluation-orchestrator.mjs` — 3-step demo: full pipeline, legacy draft round-trip, clarification_required.
- `src/index.ts` — added orchestrator export.
- `package.json` — added `demo:evaluation-orchestrator` script.
- `apps/api/src/runtime/runtime.module.ts` — registered `EvaluationOrchestrator` as NestJS provider.

Commands run:

```bash
npm run build      # clean
npm run api:build  # clean
npm run web:build  # clean
npm test           # 352/352 pass (was 307, +45 new tests)
npm run demo:evaluation-orchestrator  # pass
npm run demo:analysis    # unchanged
npm run demo:guided-regen  # unchanged
```

Follow-up: TASK-0019 — Prisma Persistence for IntakeEvaluation.

## 2026-06-12 — TASK-0017 Mock Agent Implementations — All 12 Evaluation Agents

Requested: implement all 12 deterministic mock evaluation agents. No real AI calls, no orchestrator, no Prisma changes.

Changes made:

- `src/application/agents/mock/mock-agent-helpers.ts` — shared helpers: normalize, containsAny, inferComplexity, estimateStoryPoints, inferTechStack, detectIntegrationPoints, detectDataStores, slugify.
- 12 mock agent files, one per section kind.
- `src/application/agents/mock/index.ts` — factory: `createAllMockEvaluationAgents`, `createMockEvaluationAgentsForDepth`, `runMockEvaluationAgentsSequentiallyForTest`.
- `tests/mock-evaluation-agents.test.mjs` — 49 agent-level tests.
- `tests/mock-evaluation-agent-factory.test.mjs` — 19 factory + round-trip tests.
- `src/index.ts` — added mock agents export.

Commands run:

```bash
npm run build      # clean
npm run api:build  # clean
npm run web:build  # clean
npm test           # 307/307 pass
npm run demo:analysis  # unchanged
```

Follow-up: TASK-0018 — Evaluation Orchestrator (3-stage pipeline, NestJS integration).

## 2026-06-12 — TASK-0016 Domain Foundation — Evaluation Aggregate & Agent Contracts

Requested: establish pure domain types for the 12-agent evaluation pipeline (Option A). No behavior change, no Prisma, no API routes, no UI.

Changes made:

- `src/application/intake-evaluation.ts` — 12 `EvaluationSectionKind` values, `EvaluationSection<TContent>` generic, all 12 typed section content interfaces, `IntakeEvaluation` aggregate, `QualityScore` with 6 dimensions + readiness band, depth routing table (`EVALUATION_DEPTH_ROUTING_TABLE`), `validateEvaluationSection`, `validateIntakeEvaluation`, helpers (`getSection`, `assertEvaluationSectionKind`, `qualityBandFromScore`).
- `src/application/agents/agent-contract.ts` — `AgentRunContext`, `AgentRunOptions`, `AgentOutput<TContent>`, `EvaluationAgent<TContent>` interface.
- `src/application/evaluation-draft-mapper.ts` — `evaluationToLegacyDraft()` + `legacyDraftToEvaluation()` bidirectional mapper.
- `tests/intake-evaluation-domain.test.mjs` — 31 tests.
- `tests/evaluation-agent-contract.test.mjs` — 15 tests.
- `tests/evaluation-draft-mapper.test.mjs` — 30 tests.
- `src/index.ts` — added exports for new modules.

Commands run:

```bash
npm run build      # clean
npm run api:build  # clean
npm run web:build  # clean
npm test           # 205/205 pass
```

Follow-up: TASK-0017 — 12 mock evaluation agents.

## 2026-06-12 — TASK-0015 AI Provider Router & Real Provider Adapters

Requested: add a real AI provider layer behind the `IntakeAnalysisProvider` interface. `IntakeWorkflowService` should route to OpenAI, Anthropic, Bedrock, or mock based on `AI_PROVIDER` env. No governance changes. No silent fallback.

Changes made:

- `src/application/intake-analysis-provider.ts` — `IntakeAnalysisProvider` interface, options, result, metadata types.
- `src/application/providers/` — `analysis-draft-output-schema.ts`, `prompt-templates.ts`, `token-cost.ts`, `analysis-provider-config.ts`, `mock-intake-analysis-provider.ts`, `draft-output-mapper.ts`, `openai-intake-analysis-provider.ts`, `anthropic-intake-analysis-provider.ts`, `bedrock-intake-analysis-provider.ts`, `analysis-provider-router.ts`.
- `apps/api/src/ai/provider.token.ts` — shared `ANALYSIS_PROVIDER` Symbol injection token.
- `apps/api/src/runtime/runtime.module.ts` — factory for `ANALYSIS_PROVIDER`, injected into `IntakeWorkflowService`.
- `apps/api/src/modules/health/health.controller.ts` — injects `ANALYSIS_PROVIDER`, `/health` exposes `ai.provider`.
- `src/index.ts` — exports new provider interface and related types.
- `.env.example`, `.env.server.example` — AI provider env vars documented.
- `scripts/smoke-ai-provider.mjs`, `package.json` — `smoke:ai-provider` script.
- `tests/analysis-provider-config.test.mjs`, `tests/analysis-provider-router.test.mjs`, `tests/mock-intake-analysis-provider.test.mjs`, `tests/openai-intake-analysis-provider.test.mjs`, `tests/anthropic-intake-analysis-provider.test.mjs`, `tests/bedrock-intake-analysis-provider.test.mjs` — 44 new tests.

Commands run:

```bash
npm run build:core   # passed
npm test             # 127/127 passed (44 new tests added)
npm run smoke:ai-provider  # passed (mock provider)
npm run api:build    # passed
```

Two TypeScript fixes required:
- `anthropic-intake-analysis-provider.ts`: cast via `as unknown as Anthropic.Tool["input_schema"]` due to `readonly` tuple.
- `bedrock-intake-analysis-provider.ts`: cast via `{ json: ... } as ToolInputSchema` due to Smithy `DocumentType` mismatch with `readonly` schema object.

## 2026-06-12 — TASK-0014 guided AI draft regeneration

Requested: let `intake_owner` and `devops_lead` steer the mock AI toward a better draft via free-text guidance.

Context: TASK-0013 made actor attribution real, so guidance is now attributable to an authenticated person.

Changes made:
- `src/domain/permissions.ts` — added `steer_analysis_draft` action; granted to `intake_owner`, `devops_lead`, `admin`.
- `src/application/errors.ts` — added `ConflictError` (maps to HTTP 409).
- `src/application/types.ts` — added `RegenerateAnalysisDraftInput` interface; added `analysisDraftRegenerationCount` to `ProjectIntakeRecord`.
- `src/application/intake-analysis.ts` — added `guidance?: string` to `GenerateMockAnalysisDraftInput`; mock provider visibly incorporates guidance (scope note + story point bias).
- `src/application/intake-workflow-service.ts` — added `regenerateAnalysisDraft()` with all guards; supersedes prior draft; increments counter; emits `ANALYSIS_DRAFT_REGENERATED` audit event.
- `apps/api/src/common/application-exception.filter.ts` — mapped `ConflictError` to `ConflictException` (409).
- `apps/api/src/modules/intake/dto/regenerate-analysis-draft.dto.ts` — new DTO with `@IsString() @MinLength(10) guidance`.
- `apps/api/src/modules/intake/intake.controller.ts` — added `POST /intakes/:id/analysis-drafts/regenerate`.
- `tests/guided-draft-regeneration.test.mjs` — 10 new tests (all pass).
- `scripts/demo-guided-regeneration.mjs` — full v1 → guidance → v2 → guidance → v3 → accept demo.
- `package.json` — added `demo:guided-regen` npm script.

Verification:
- `npm run check` — PASS (83/83, including 10 new tests)
- `npm run api:build` — PASS
- `npm run demo:guided-regen` — PASS (v1→v2→v3→accept→Gate1 flow confirmed)

Next: TASK-0015 — real AI provider integration (guidance field maps directly onto prompt)

## 2026-06-12 — TASK-0013 authenticated internal access & role resolution

Requested: replace the actor-header shim with real authenticated access, add Google OAuth, preserve dev mode.

Context: TASK-0012 deployed the server stack. Auth was next before any downstream integrations or live keys.

Changes made:
- Added `AuthUser` and `AuthSession` Prisma models (server-side sessions, hashed tokens).
- Added full NestJS auth module: `role-resolver`, `session.service`, `google-auth.service`, `auth.service`, `auth.guard`, `auth.decorators`, `auth.controller`, `auth.module`.
- Global `AuthGuard` with dual mode: `dev_headers` (headers) and `google` (session cookie).
- Health and `/auth/*` routes marked `@Public()`. Bitrix24 webhook also `@Public()`.
- `@CurrentActor()` decorator replaces header bag in all intake controller methods.
- `intake.controller.ts` now passes `toDomainActor(actor)` to workflow service.
- Added `cookie-parser` middleware; CORS updated to allow credentials from `WEB_ORIGIN`.
- Frontend: `AuthProvider`, `UserMenu`, `AuthGate`, `ClientLayout`, `/login` page.
- `AppShell` shows `UserMenu` (google mode) or `ActorSelector` (dev mode).
- `api-client.ts` uses `credentials: include` + conditional actor headers.
- `NEXT_PUBLIC_AUTH_MODE` build arg wired into `Dockerfile.web` and `docker-compose.server.yml`.
- Auth env vars added to `.env.example` and `.env.server.example`.
- New tests: `auth-role-resolution` (11), `auth-session` (8), `auth-actor-resolution`.

Verification:
- `npm run check` — PASS (73/73)
- `npm run api:build` — PASS
- `npm run web:build` — PASS
- `npm run prisma:generate` — PASS
- All demos — PASS
- New auth tests — PASS (19/19)

Next: TASK-0014 — guided AI draft regeneration (now safe with real actor attribution)

## 2026-06-11 — TASK-0012 private server runtime deployment

Requested: make the project deployable on a private server without a domain, HTTPS, or public exposure.

Context: server already runs Uptime Kuma on host port 3001. App still uses actor header shims.

Changes made:
- Added `Dockerfile.api` (root) — production-grade multistage build, `prisma migrate deploy` on startup.
- Added `Dockerfile.web` (root) — Next.js multistage build, `NEXT_PUBLIC_API_BASE_URL` baked in as ARG.
- Added `docker-compose.server.yml` — postgres (127.0.0.1:5432), api (expose only), web (expose only, no host port 3001), local-proxy (127.0.0.1:8080 via Caddy).
- Added `.env.server.example` with documented variables.
- Added `deploy/Caddyfile.server` — routes /api/* to api:3000, everything else to web:3001.
- Added `deploy/Caddyfile.funnel.example` — basic auth example for Tailscale Funnel demo mode.
- Added `deploy/deploy-server.sh`, `healthcheck-server.sh`, `backup-postgres.sh`, `restore-postgres.sh` (all executable).
- Added `deploy/tailscale-serve-notes.md`, `deploy/tailscale-funnel-notes.md`.
- Added `server:build`, `server:up`, `server:down`, `server:ps`, `server:logs`, `server:health`, `server:deploy`, `server:backup` scripts to `package.json`.
- Added `seed:demo:server` script (no `--env-file=.env` for container use where env comes from docker-compose).
- Updated `.gitignore`: `.env.server`, `backups/`, `*.sql`, `*.dump`, `apps/web/.next/`.
- Added `docs/deployment/private-server-runtime.md`.
- Created task log `docs/ai/tasks/TASK-0012-private-server-runtime-deployment.md`.
- Updated `docs/ai/MEMORY_INDEX.md`, `docs/ai/SEQUENCE_LOG.md`.

Key decisions:
- Host port 3001 remains reserved for Uptime Kuma. Web container uses `expose:` not `ports:`.
- Local proxy binds to `127.0.0.1:8080` only — SSH tunnel is default access.
- NEXT_PUBLIC_API_BASE_URL=/api for proxy mode. Rebuild web image if changed.
- Tailscale Serve is optional private mode; Funnel is optional temporary demo mode only.

Commands run:

```bash
npm run check           # pass
npm run api:build       # pass
npm run web:build       # pass
npm run prisma:generate # pass
npm run demo:mvp        # pass
npm run demo:analysis   # pass
npm run demo:analysis-review  # pass
npm run demo:review-guard     # pass
npm run demo:reviewed-distribution # pass
```

Server stack verification (Docker required on server):

```bash
cp .env.server.example .env.server
npm run server:build && npm run server:up && npm run server:ps && npm run server:health
```

## 2026-06-10 — TASK-0011 end-to-end runtime smoke & seeded demo data

Requested: make the project easy to seed, demo, smoke-test, and pause cleanly.

Baseline confirmed: 49/49 tests, api:build, web:build, prisma:generate, all 5 demos passing before implementation.

Changes made:
- Added `scripts/seed-demo-data.mjs` — seeds 6 demo intakes into Postgres via application service + inline Prisma store. Idempotent: deletes records where `requester = "demo.requester@local"` before recreating.
- Added `scripts/smoke-runtime-workflow.mjs` — 8-phase governance smoke test against live API: infrastructure, CRUD, submission, AI draft, human review, Gate 1, Gate 2, distribution preview, audit trail. Hard assertions on `source.type = reviewed_project_package` and all `dryRun = true`.
- Added `npm run seed:demo`, `npm run smoke:runtime`, `npm run db:reset:demo` scripts to root `package.json`.
- Updated `README.md`: build state to TASK-0011, Seeded Demo Data section with table of 6 intakes, updated browser walkthrough to use seeded records, new scripts in reference table.
- Created task log `docs/ai/tasks/TASK-0011-end-to-end-runtime-smoke-and-seeded-demo-data.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Seeded demo records:
1. Payment Failure Notification Fix → draft
2. Marketing Dashboard Request → submitted
3. Customer Portal Enhancement → intake_review (AI draft, no reviewed package)
4. Internal SSO Management Tool → intake_review (reviewed package ready)
5. Data Pipeline Migration → devops_review (Gate 1 approved)
6. Project Intake OS UI Buildout → approved + provisioning plan

Commands run:

```bash
npm run check           # 49/49 pass (unchanged)
npm run api:build       # pass
npm run web:build       # pass
npm run prisma:generate # pass
npm run demo:analysis   # pass
npm run demo:analysis-review   # pass
npm run demo:review-guard      # pass
npm run demo:reviewed-distribution  # pass
npm run demo:mvp        # pass
```

Live runtime verification (requires Docker/Postgres):
```bash
docker compose up -d postgres
npm run prisma:migrate
npm run seed:demo           # seeds 6 demo intakes
npm run api:start:dev
npm run smoke:api           # quick health/CRUD
npm run smoke:runtime       # full governance flow
npm run web:dev             # open http://localhost:3001/intakes
```

Result: seed script, runtime smoke, and docs are complete. This is a clean pause point.

## 2026-06-10 — TASK-0010 minimal Next.js review UI

Requested: build the first browser-operable interface for Project Intake OS.

Baseline confirmed: 49/49 tests, api:build, all demos passing before implementation.

Changes made:
- Created `apps/web` as a Next.js 15 App Router + TypeScript + Tailwind CSS v3 application.
- Dark sidebar AppShell with actor selector; actor persists to localStorage.
- Preconfigured actors: Request Creator, Intake Owner, DevOps Lead, Admin, Developer.
- API client with actor headers, readable error surfacing, all workflow endpoints.
- `/intakes` — intake list table with status badges, links, create/refresh.
- `/intakes/new` — create intake form with workflow preview banner.
- `/intakes/[id]` — detail page with 7 tabs: Overview, AI Draft, Reviewed Package, Approvals, Distribution, Audit Trail, Debug.
- Governance visible: Gate 1/2 guards shown in UI, dry-run notice on Distribution, AI notice on AI Draft, reviewed package source-of-truth banner.
- Added `web:dev`, `web:build`, `web:start` scripts to root `package.json`.
- Added `NEXT_PUBLIC_API_BASE_URL` to `.env.example` and `apps/web/.env.local.example`.
- Task log `docs/ai/tasks/TASK-0010-minimal-nextjs-review-ui.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm install --prefix apps/web     # pass
npm run web:build                  # pass (6 routes)
npm run check                      # 49/49 pass (unchanged)
npm run api:build                  # pass
npm run demo:analysis              # pass
npm run demo:analysis-review       # pass
npm run demo:review-guard          # pass
npm run demo:reviewed-distribution # pass
npm run demo:mvp                   # pass
```

Live stack smoke test (requires running Docker/Postgres/API):
```bash
cp .env.example .env
docker compose up -d postgres
npm run prisma:migrate
npm run api:start:dev
npm run web:dev
# Open http://localhost:3001 and follow manual walkthrough
```

Result: Next.js UI is buildable and ready for manual browser walkthrough once the stack is running.

## 2026-06-10 — TASK-0009 API runtime & dependency stabilization

Requested: make the NestJS/Prisma/Postgres runtime reliably installable, buildable, and locally runnable.

Baseline confirmed: 49/49 tests passing, api:build passing before implementation.

Changes made:
- Split health controller: `GET /health` is a liveness check (no DB dependency); `GET /health/db` is a readiness check (Postgres query).
- Added npm scripts: `prisma:generate`, `prisma:migrate`, `prisma:migrate:deploy`, `prisma:migrate:reset`, `prisma:db:push`, `prisma:studio`, `api:start:dev`, `docker:up`, `docker:down`, `smoke:api`.
- Updated `.env.example` with `NODE_ENV`, `API_PORT`, `API_HOST`, `POSTGRES_*`, `SWAGGER_*`, dual DATABASE_URL comment.
- Created `scripts/smoke-api.mjs` — tests health, Swagger, list intakes, create, submit, optional mock draft, optional DB health.
- Rewrote `README.md` with full local setup flow, script reference table, endpoint table, troubleshooting section.
- Created task log `docs/ai/tasks/TASK-0009-api-runtime-dependency-stabilization.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm run check                      # 49/49 pass (unchanged)
npm run prisma:generate            # pass
npm run api:build                  # pass
npm run demo:analysis              # pass
npm run demo:analysis-review       # pass
npm run demo:review-guard          # pass
npm run demo:reviewed-distribution # pass
npm run demo:mvp                   # pass
```

Result: runtime is stable and documented. A clean clone can install, generate Prisma client, build the API, start Postgres, and pass smoke tests.

## 2026-06-10 — TASK-0008 distribution preview from reviewed project package

Requested: make ReviewedProjectPackage the authoritative source for dry-run provisioning/distribution preview.

Baseline confirmed: 44/44 tests passing before implementation.

Changes made:
- Added `DistributionSourceType`, `ProvisioningPlanSource` types and `source` field to `ProvisioningPlan` in `types.ts`.
- Added `resolveDistributionSource` to `provisioning-plan.ts` — returns `reviewed_project_package`, `manual_discovery`, or `legacy_intake_record`. Throws if AI drafts exist but no reviewed package.
- Added `buildIssueTitlesFromPackage` helper — uses reviewed subtask titles for GitHub initial issues.
- Updated `buildDryRunProvisioningPlan` to use reviewed package fields (projectType, subtasks, brief, estimatedStoryPoints) when present.
- Updated `generateProvisioningPlan` audit metadata to include `sourceType` and `sourceId`.
- Added `tests/distribution-preview-source.test.mjs` (5 new tests).
- Added `scripts/demo-reviewed-package-distribution-preview.mjs` and `demo:reviewed-distribution` package script.
- Created task log, updated MEMORY_INDEX.

Commands run:

```bash
npm run check                      # 49/49 pass (44 original + 5 new)
npm run demo:analysis              # pass
npm run demo:analysis-review       # pass
npm run demo:review-guard          # pass
npm run demo:reviewed-distribution # pass
npm run demo:mvp                   # pass
```

Result: product boundary fully complete — distribution preview derives exclusively from human-reviewed package when one exists.

## 2026-06-10 — TASK-0007 require reviewed package before Gate 1 approval

Requested: close the governance gap from TASK-0006 — Gate 1 approval must require a ReviewedProjectPackage when AI analysis drafts exist.

Baseline confirmed: 38/38 tests passing before implementation.

Changes made:
- Added Gate 1 guard in `recordApproval`: blocks if `analysisDrafts.length > 0` and `reviewedProjectPackage` is missing.
- Updated existing test in `intake-analysis-draft.test.mjs` to accept draft before Gate 1 (now required).
- Added `tests/approval-reviewed-package-guard.test.mjs` (6 new tests).
- Added `scripts/demo-reviewed-package-approval-guard.mjs` and `demo:review-guard` package script.
- Created task log `docs/ai/tasks/TASK-0007-require-reviewed-package-before-gate-1.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm run check            # 44/44 pass (38 original + 6 new)
npm run demo:analysis    # pass
npm run demo:analysis-review  # pass
npm run demo:review-guard  # pass
npm run demo:mvp         # pass
```

Result: governance model fully enforced — AI drafts must be human-reviewed before Gate 1 approval. No-AI/manual path unchanged.

## 2026-06-10 — TASK-0006 analysis review lifecycle

Requested: implement the Analysis Review Lifecycle (TASK-0006) from the task-6-handoff.md spec.

Context read:
- `CLAUDE.md`, `BUILD_GUIDE.md`
- `docs/ai/PROJECT_MEMORY.md`, `docs/ai/MEMORY_INDEX.md`
- `docs/ai/tasks/TASK-0005-mock-ai-analysis-draft-module.md`
- `src/application/intake-analysis.ts`, `src/application/intake-workflow-service.ts`
- `src/domain/workflow.ts`, `src/domain/permissions.ts`
- `src/application/types.ts`
- `tests/intake-analysis-draft.test.mjs`

Baseline confirmed: 28/28 tests passing before implementation.

Changes made:
- Added `ReviewedProjectPackage`, `ReviewedProjectPackageInput`, `AnalysisDraftReviewDecision`, `AcceptAnalysisDraftInput`, `RejectAnalysisDraftInput`, `ReviseAnalysisDraftInput` types to `src/application/types.ts`.
- Added `reviewedProjectPackage` field to `ProjectIntakeRecord`.
- Added `review_analysis_draft` permission to `src/domain/permissions.ts` (granted to `intake_owner`, `devops_lead`, `admin`).
- Added `acceptAnalysisDraft`, `rejectAnalysisDraft`, `reviseAnalysisDraft` methods to `IntakeWorkflowService`.
- Added `requireDraft` and `requireDraftPendingReview` helpers.
- Added audit events: `ANALYSIS_DRAFT_ACCEPTED`, `ANALYSIS_DRAFT_REJECTED`, `ANALYSIS_DRAFT_REVISED`, `REVIEWED_PROJECT_PACKAGE_CREATED`.
- Added `tests/analysis-review-lifecycle.test.mjs` (10 new tests).
- Added `scripts/demo-analysis-review.mjs` and `demo:analysis-review` package script.
- Added API DTOs: `AcceptAnalysisDraftDto`, `RejectAnalysisDraftDto`, `ReviseAnalysisDraftDto`.
- Added API controller endpoints: `POST /intakes/:id/analysis-drafts/:draftId/accept|reject|revise`.
- Created task log `docs/ai/tasks/TASK-0006-analysis-review-lifecycle.md`.
- Updated `docs/ai/MEMORY_INDEX.md`.

Commands run:

```bash
npm run check         # 38/38 pass (28 original + 10 new)
npm run demo:analysis # pass
npm run demo:analysis-review  # pass
npm run demo:mvp      # pass
```

Result: all checks pass. Product boundary between AI draft and human-reviewed package is now enforced.

Follow-up:
- Optional Gate 1 guard requiring `reviewedProjectPackage` before approval.
- Prisma schema update for `reviewedProjectPackage` JSON column when DB is active.

## 2026-05-26 — TASK-0001 bootstrap domain core

Requested: start building the Project Intake OS from the uploaded repository.

Context read:

- `AGENTS.md`
- `BUILD_GUIDE.md`
- `docs/product/product-overview.md`
- `docs/product/workflow-state-machine.md`
- `docs/product/project-type-registry.md`
- `docs/product/permissions-and-ownership.md`
- `docs/product/repository-and-naming.md`
- `docs/product/requirements-trace.md`

Changes made:

- Added TypeScript package scaffolding with local scripts.
- Added framework-neutral domain modules for workflow, permissions, project type registry, and repository naming.
- Added Node test runner coverage for the implemented domain slice.
- Added durable AI memory files under `docs/ai/`.
- Added `ADR-0001` documenting the domain-first build decision.
- Updated product requirements trace statuses for implemented/tested foundation requirements.

Commands run:

```bash
npm run typecheck
npm test   # initially failed because Node was invoked against the tests directory instead of test files
npm run check
npm run ai:index
# package verification in a clean unzip
npm run check
```

Result: checks passed after implementation fixes. The packaged zip was verified from a clean unzip with `npm run check`.

Follow-up:

- Add persistence/API boundary around the domain core.
- Recreate or add missing `docs/product/distribution-rules.md` before implementing live distribution package behavior.
- Choose the monolith framework and database migration approach.

## 2026-05-27 — TASK-0002 iteration 2 no-AI MVP runtime foundation

Requested: implement the MVP/POC boundary through Iteration 2 without the AI layer.

Context decisions applied:

- Use a NestJS-ready modular monolith shape.
- Keep the verified code path dependency-free because package installation was unavailable in this environment.
- Treat Bitrix24 as an intake/source adapter, not the source of truth.
- Keep GitHub, Monday, and Bitrix24 writes as dry-run provisioning actions only.

Changes made:

- Added `src/application` service layer around the domain rules.
- Added in-memory persistence and audit trail contracts.
- Added dry-run provisioning plan generation with GitHub/Monday/docs/Bitrix24 action modeling.
- Added Bitrix24 payload normalization.
- Added `apps/api` composition root and controller shell for the future NestJS app.
- Added `apps/api/prisma/schema.prisma` as the Postgres-minded schema draft.
- Added Dockerfile and Docker Compose baseline.
- Added MVP demo script.
- Added API/deployment documentation.
- Added ADR-0002 for the portable NestJS-ready runtime decision.
- Added lifecycle and Bitrix24 tests.

Commands run:

```bash
npm run typecheck
npm test
npm run demo:mvp
```

Result: 24 tests passed. The demo reaches an approved intake with a ready dry-run provisioning plan and 9 audit events.

Follow-up:

- Install real NestJS dependencies and attach decorators/routes.
- Add Prisma client and a real Postgres-backed repository adapter.
- Add OpenAPI/Swagger once NestJS is active.
- Keep live GitHub/Monday/Bitrix24 writes disabled until a separate approval/integration task.

## 2026-05-27 — TASK-0003 Dockerized NestJS API with Prisma/Postgres/Swagger

Requested: add the agreed sequence roadmap into a log file and proceed with the Dockerized NestJS API using Prisma, Postgres, and Swagger.

Context decisions applied:

- Keep Iteration 2.1 no-AI and no-live-provisioning.
- Keep the framework-neutral domain/application core as the source of workflow truth.
- Add a real NestJS HTTP runtime under `apps/api` without breaking dependency-free core verification.
- Use Prisma/Postgres for durable intake/audit persistence.
- Use Swagger as the temporary POC operator/demo UI before building Next.js.

Changes made:

- Moved dependency-free API composition root exports into `src/application/api-composition-root.ts`.
- Added real NestJS bootstrap, modules, controllers, DTOs, actor-header handling, and exception filter under `apps/api/src`.
- Added Prisma service and `PrismaProjectIntakeStore` adapter.
- Updated `apps/api/prisma/schema.prisma` with Postgres models, `recordSnapshot`, audit indexes, and provisioning plan/action models.
- Updated `package.json` with NestJS/Prisma/Swagger dependencies and API scripts.
- Added `apps/api/tsconfig.json` and `apps/api/nest-cli.json`.
- Updated Dockerfile and Docker Compose for local API + Postgres.
- Updated `.env.example`, README, API contract, and deployment docs.
- Added `docs/ai/SEQUENCE_LOG.md` with the agreed roadmap and next sequences.
- Added `docs/ai/tasks/TASK-0003-dockerized-nestjs-api.md`.

Commands run:

```bash
npm run check
npm run demo:mvp
```

Result: 24 core tests passed and the no-AI lifecycle demo still reaches an approved intake with a ready dry-run provisioning plan.

Known constraint: full API dependency build was not verified because npm package fetching was unavailable in the execution environment. The next environment with package access should run:

```bash
npm install
npm run api:build
npm run api:docker:up
```

Follow-up:

- Generate and commit `package-lock.json` after dependencies are installed.
- Add API smoke tests against the running NestJS server.
- Replace POC `prisma db push` with reviewed migrations before production-like deployment.
- Add a Swagger/curl demo sequence for actor-specific approval flow.

## 2026-06-05 — TASK-0004 R&D realignment for AI intake analysis module

Requested: continue the R&D ourselves while preserving the full Project Intake OS direction rather than shrinking into a one-off automation.

Repository inspection findings:

- Core TypeScript build and tests passed in the current environment.
- `npm run check` passed with 24/24 tests.
- `npm run demo:mvp` reached an approved intake with a ready dry-run provisioning plan.
- NestJS/Prisma API source exists, but dependency-backed API build still requires `npm install`, Prisma generation, package-lock creation, and Docker smoke testing.

Changes made:

- Added R&D decision memo, feasibility analysis, and cost estimate under `docs/rd`.
- Added input trigger strategy, intake analysis schema draft, and distribution rules under `docs/product`.
- Added roster API and Monday mapping docs under `docs/integrations`.
- Added compliance and retention posture under `docs/security`.
- Added TASK-0004 task log.
- Updated sequence log with Iteration 2.2 and TASK-0005 recommendation.

Next recommended task:

```text
TASK-0005 — implement mock AI analysis draft module.
```

## 2026-06-09 — TASK-0005 mock AI analysis draft module

Requested: start the first real build slice after R&D realignment.

Context decisions applied:

- Keep the full Project Intake OS direction.
- Exclude n8n from OS orchestration/plumbing.
- Add AI analysis as schema-backed draft output, not as an autonomous actor.
- Keep live AI providers, Monday writes, GitHub writes, and provisioning execution disabled.

Changes made:

- Added `src/application/intake-analysis.ts` with the `IntakeAnalysisDraft` v1 contract, deterministic mock provider, and validator.
- Added `analysisDrafts` and `latestAnalysisDraft` to `ProjectIntakeRecord`.
- Added `IntakeWorkflowService.generateMockAnalysisDraft()`.
- Added framework-neutral controller support for mock analysis generation.
- Added NestJS DTO/controller source for `POST /intakes/:id/analysis-drafts/mock`.
- Added Prisma JSON fields for `analysisDrafts` and `latestAnalysisDraft`.
- Added `tests/intake-analysis-draft.test.mjs`.
- Added `scripts/demo-analysis-draft.mjs` and `npm run demo:analysis`.
- Added ADR-0003 documenting OS-owned orchestration and no n8n runtime.
- Updated R&D, product, API, and README docs.

Commands run:

```bash
npm run check
npm run demo:mvp
npm run demo:analysis
npm run api:build   # blocked: prisma CLI not installed in unpacked package
npm install         # attempted once; timed out in this environment before producing node_modules/package-lock
```

Result: 28/28 core tests passed. The mock analysis demo reaches `intake_review` with a draft analysis, zero approvals, no provisioning plan, and the expected audit sequence.

Known constraint: full API dependency build still requires package installation because the unpacked package does not include `node_modules` or a generated lockfile.

Follow-up:

- Add analysis review accept/reject/supersede actions.
- Add human-edited reviewed project package separate from the immutable generated draft.
- Add Next.js review UI after the review contract is stable.
- Add live provider integration only after compliance/provider decisions are confirmed.

---

## 2026-06-22 — TASK-0031: Post-Distribution Lifecycle

**Session:** Continuing from prior session (TASK-0029 and TASK-0030 already complete)

**Changes:**
- Added `in_progress`, `blocked`, `completed`, `canceled` to `RequestStatus` Prisma enum + domain types
- Created `src/domain/lifecycle-transitions.ts` with `validateLifecycleTransition()` pure domain function
- Added lifecycle metadata fields (`blockedAt`, `completedAt`, etc.) to `ProjectIntakeRecord`
- Added `executeLifecycleTransition()` to `IntakeWorkflowService`
- Created `POST /intakes/:id/lifecycle/:action` NestJS endpoint + DTO
- Added lifecycle functions to web api-client
- Added 4 new statuses to `apps/web/src/lib/status.ts`
- Created `/distributed` dashboard page for post-distribution lifecycle management
- 528/528 tests pass

**Follow-up:** Run `prisma migrate dev --name add-post-distribution-lifecycle` on oreochiserver

---

## 2026-06-23 — TASK-0032: Input Validation Hardening

**Session:** Continuing from TASK-0031 same session

**Changes:**
- Created `apps/api/src/common/validation-constants.ts` with 14 named length constants
- Added `@MaxLength` decorators to all DTO string fields: `CreateIntakeDto`, `RequestChangesDto`, `ApprovalDecisionDto`, `RejectAnalysisDraftDto`, `RegenerateAnalysisDraftDto`, `CompleteDiscoveryDto`, `LifecycleTransitionDto`
- Replaced magic numbers in `LifecycleTransitionDto` with named constants
- Changed `forbidNonWhitelisted: false` → `true` in global ValidationPipe
- Created `tests/input-validation.test.mjs` (34 tests) using `class-validator`'s `validate()` directly
- 528/528 tests pass (pre-TASK-0033 count)

---

## 2026-06-23 — TASK-0033: Google OAuth Activation

**Session:** New session

**Context:** Full Google OAuth implementation already existed from TASK-0027. This task activated it.

**Changes:**
- `src/auth-config-validator.ts` — removed TODO hold; now hard-fails at startup when `AUTH_MODE=google` and `AUTH_GOOGLE_CLIENT_ID` is missing; fixed env var name (`GOOGLE_CLIENT_ID` → `AUTH_GOOGLE_CLIENT_ID` to match service)
- `tests/auth-config-validator.test.mjs` — added `AUTH_GOOGLE_CLIENT_ID` env setup to google-mode success tests; added new test: google mode without client ID throws
- `tests/google-oauth.test.mjs` — NEW: 23 tests covering URL generation, state token format, role config env parsing, session TTL math, forbidden-user path
- `docs/ai/tasks/TASK-0033-google-oauth.md` — NEW task log with activation checklist for oreochiserver
- 582/582 tests pass (54 new tests added across TASK-0032 and TASK-0033)

**Open blocker:** `AUTH_GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_CLIENT_SECRET` still need to be provisioned in Google Cloud Console and added to `.env.server` before `AUTH_MODE=google` can be activated on oreochiserver.

---

## 2026-06-26 — Discovery Engine Phase 1

**Session:** New session (Discovery Engine spec introduced)

**Context:** `docs/discovery_engine_spec.pdf` specifies an ambiguity-resolution engine that sits before the existing evaluation orchestrator. Phase 1 builds the domain foundation, session management, mock agents, orchestrator, and controller — all without external dependencies.

**Product decision:** The 12-dimension framework (Problem Framing, Requirements, System Design, Scalability, Reliability, Observability, Security, Infrastructure, Cost Engineering, Trade-offs, Documentation) is used as a suggestive coverage map — each dimension is a `DimensionSlot<T>` (nullable, confidence-scored, source-tagged). Multiple evaluation paths remain viable; not every dimension must be populated.

**Files added:**
- `src/domain/discovery.ts` — `DimensionSlot<T>`, `DiscoveryStatus`, `DiscoverySideStatus`, `IntentType`, `DiscoveryConfidence`, `confidenceTier()`, `overallConfidence()`, `ProblemFrame`, `IntentExtractionResult`, `ClarificationQuestion`, `SolutionOption`, `ProjectProposal` (12-dimension scaffold), `ProvisioningManifest`, `DiscoverySession`
- `src/application/discovery/discovery-session-store.ts` — `IDiscoverySessionStore` + `InMemoryDiscoverySessionStore`
- `src/application/discovery/agents/discovery-agent-contract.ts` — `IIntentExtractionAgent`, `IProblemFramingAgent`
- `src/application/discovery/agents/mock-intent-extraction-agent.ts` — keyword-based mock; detects intent type and solution bias
- `src/application/discovery/agents/mock-problem-framing-agent.ts` — per-dimension confidence scoring; extracts pain points, unknowns, affected users
- `src/application/discovery/discovery-orchestrator.ts` — `DiscoveryOrchestrator` with `startDiscovery`, `addMessage`, `getSession`, `listSessions`; confidence-gated status transitions; never regresses status
- `src/application/discovery/discovery-controller.ts` — `DiscoveryController` (framework-neutral)
- `src/application/discovery/index.ts` — barrel export
- `tests/discovery-phase-1.test.mjs` — 24 tests covering confidence domain, session store, orchestrator, controller, proposal scaffold

**Files modified:**
- `src/application/api-composition-root.ts` — wired `DiscoveryOrchestrator` + `DiscoveryController` into composition root
- `src/index.ts` — added discovery exports

**Tests:** 616/616 pass (24 new). Zero regressions.

**Handoff:**
- Phase 2 next: Solution generation agent, clarification agent (dimension-guided questions), direction selection, confidence recompute loop
- Phase 3: Proposal composer, evaluation handoff adapter (maps 12-dimension proposal → `ProjectIntakeRecord`)
- Live agents (OpenAI/Anthropic/Bedrock) for intent + framing come after mock path is stable

---

## 2026-06-26 — Discovery Engine Phase 2

**Session:** Continued from Phase 1 (same session)

**Changes:**

- `src/application/discovery/agents/mock-solution-generation-agent.ts` — NEW: `MockSolutionGenerationAgent`; generates 2-4 ranked `SolutionOption[]` from intent-keyed template table (10 intent types covered); recommends low-complexity options when unknowns are high
- `src/application/discovery/agents/mock-clarification-agent.ts` — NEW: `MockClarificationAgent`; scores each of the 6 confidence dimensions; selects up to 2 decision-changing questions per turn; skips dimensions already above 0.70 confidence; skips questions irrelevant to intent type (e.g. no disaster-recovery questions for microtasks)
- `src/application/discovery/agents/discovery-agent-contract.ts` — MODIFIED: added `ISolutionGenerationAgent`, `IClarificationAgent`; added `existingQuestions?` to `DiscoveryAgentContext`
- `src/application/discovery/discovery-orchestrator.ts` — MODIFIED: added `generateSolutions`, `answerClarification`, `selectDirection`; confidence recomputes after each clarification answer; blocking questions gate next clarification round; status never regresses
- `src/application/discovery/discovery-controller.ts` — MODIFIED: added `generateSolutions`, `answerClarification`, `selectDirection` controller methods
- `src/application/discovery/index.ts` — MODIFIED: exported new agents
- `src/application/api-composition-root.ts` — MODIFIED: wired `MockSolutionGenerationAgent`, `MockClarificationAgent`
- `tests/discovery-phase-2.test.mjs` — NEW: 22 tests (solution generation, clarification, direction selection, E2E happy path)
- `tests/discovery-phase-1.test.mjs` — MODIFIED: updated `DiscoveryOrchestrator` constructor call to include new agents

**Bug fixed:** Intent signal ordering — "chatbot" was being overridden by "automatically" because `automation` was first in the table. Reordered to put more specific signals (chatbot, llm, dashboard, bug) before general ones (automation, process).

**Tests:** 638/638 pass (22 new Phase 2 tests). Zero regressions.

**Handoff:**
- Phase 3 next: Proposal composer agent, proposal completeness gate, evaluation handoff adapter (`ProjectProposal` → `ProjectIntakeRecord`), `POST /discovery/:id/send-to-evaluation`

## 2026-06-27 — Discovery Engine Phases 3–6 Complete + Live OpenAI Wiring

**Session:** Continuation (Phases 4–6 from 2026-06-26 BUILD_LOG, integrated with live agent activation)

**Changes:**

### Phases 3–4: Proposal Composer + Manifest Generator
- `src/application/discovery/agents/mock-proposal-composer-agent.ts` — builds 12-dimension `ProjectProposal`; confidence-scored; completeness gate determines `evaluation_ready` status
- `src/application/discovery/agents/mock-manifest-generator-agent.ts` — maps intent types to `recommendedAction`; populates Monday epics/tasks, GitHub labels, slug-formatted repo; `readyForLiveAdapter: false` (mock)
- `src/application/discovery/proposal-to-intake-adapter.ts` — bidirectional `ProjectProposal ↔ ProjectIntakeRecord` mapping
- `src/application/discovery/agents/discovery-agent-contract.ts` — added `IProposalComposerAgent`, `IManifestGeneratorAgent` interfaces
- `src/application/discovery/discovery-orchestrator.ts` — added `composeProposal()`, `sendToEvaluation()`, `generateManifest()` methods
- `src/application/discovery/discovery-controller.ts` — added 6 routes (POST /:id/proposal, POST /:id/manifest, POST /:id/send-to-evaluation, etc.)

### Phase 5: NestJS DiscoveryModule
- `apps/api/src/modules/discovery/discovery.module.ts` — module with `useFactory` wiring all 7 mock agents
- `apps/api/src/modules/discovery/discovery.controller.ts` — `DiscoveryHttpController` with 10 routes
- `apps/api/src/app.module.ts` — registered `DiscoveryModule`

### Phase 6: Frontend Discovery UI
- `apps/web/src/lib/discovery-client.ts` — typed API client for all 10 discovery endpoints
- `apps/web/src/lib/discovery-types.ts` — TS types mirroring discovery domain
- `apps/web/src/app/discovery/page.tsx` — session list with status badges
- `apps/web/src/app/discovery/[id]/page.tsx` — three-panel session view (chat, timeline, understanding)
- `apps/web/src/components/discovery/` — 6 components: `DiscoveryLayout`, `DiscoveryTimeline`, `DiscoveryChat`, `DiscoveryUnderstanding`, `DiscoveryStartModal`, `DiscoveryStartForm`

### Monday Manifest Schema Alignment
- Updated manifest to real 6-board Dev Ops Workspace structure:
  - Board 2: Projects Portfolio (name, type, status, stack, startDate, targetLaunch, estimatedTotalSP)
  - Board 3: Roadmap & Epics (typed items with SP and quarter)
  - Board 4: Sprint Tasks (typed items → Backlog)
  - Board 6: Microtasks & Ops (for microtask intents)
- Architecture moved to GitHub README (project brief doc), not Monday board row

### Live OpenAI Agents Wired
- Replaced 7 mock agents with real OpenAI calls using two-model routing:
  - `OPENAI_MODEL` → Discovery Engine orchestration (`gpt-5.5`)
  - `OPENAI_TASKS_MODEL` → Evaluation/analysis tasks (`gpt-5.4-mini`)
- `src/application/discovery/agents/openai-intent-extraction-agent.ts` — live agent (replaces mock)
- `src/application/discovery/agents/openai-problem-framing-agent.ts` — live agent
- `src/application/discovery/agents/openai-solution-generation-agent.ts` — live agent
- `src/application/discovery/agents/openai-clarification-agent.ts` — live agent
- `src/application/discovery/agents/openai-proposal-composer-agent.ts` — live agent
- Manifest generator remains mock (deterministic)
- `src/application/discovery/agents/index.ts` — factory routing to OpenAI when env enabled
- `src/application/providers/analysis-provider-config.ts` — wired `OPENAI_TASKS_MODEL` for eval tasks

### Environment Variables Added
- `OPENAI_MODEL` (gpt-5.5, for discovery orchestration)
- `OPENAI_TASKS_MODEL` (gpt-5.4-mini, for evaluation tasks)
- `MONDAY_BOARD_ID=18419115951` (real 6-board workspace)
- `INTAKE_APP_URL` (for README backlinks; blank until domain assigned)

### Tests Updated
- `tests/discovery-*.test.mjs` — all phases now test against live agents when credentials present, mock when absent
- 685/685 pass (up from 592)

**Deployed:** oreochiserver running live agents

**Handoff:**
- Live `gpt-5.4-mini` now handling all evaluation tasks (mock agents remain for fallback)
- Monday manifest schema is aligned to real 6-board structure
- Discovery Engine is 8-stage (intent → problem → solutions → clarification → direction → proposal → manifest → evaluation)
- Evaluation Orchestrator receives populated 12-dimension proposals from Discovery Engine

---

## 2026-06-30 — TASK-0036: Org Baseline Context in Discovery AI

### Summary
Added the Simple.biz Dev Operations workspace structure as baseline assumptions injected into every discovery AI agent system prompt. The AI can now make informed assumptions about team structure, project types, story point scale, and sprint structure without needing to ask.

### What Changed

**New File**
- `src/application/discovery/agents/org-context.ts` — `SIMPLEBIZ_ORG_CONTEXT` constant + `orgContextBlock()` helper

**Updated: Contract**
- `discovery-agent-contract.ts` — added `orgContext?: string` to `DiscoveryAgentOptions`

**Updated: OpenAI Agents** (all 5 now receive org context via system prompt append)
- `openai-intent-extraction-agent.ts` — intent types now include n8n workflow mapping; org context injected
- `openai-problem-framing-agent.ts` — stakeholderClarity and downstreamMapping scoring guidance updated
- `openai-solution-generation-agent.ts` — solutions framed using org's preferred tools
- `openai-clarification-agent.ts` — explicitly told not to ask questions answered by workspace context
- `openai-proposal-composer-agent.ts` — SP scale enforced (1/2/3/5/8/13), epics use org naming

**Updated: Settings**
- `global-settings.service.ts` — `SIMPLEBIZ_ORG_CONTEXT` as default for `discovery.org_context`; added `getOrgContext()`
- `settings.controller.ts` — `orgContext` field on PATCH /admin/settings/discovery
- `api-client.ts` — `DiscoverySettings.orgContext: string`
- `settings/page.tsx` — monospace textarea for editing workspace context in admin UI

**Updated: Orchestrator + Wiring**
- `discovery-orchestrator.ts` — `getOrgContext` option; passed to all 5 `agentOpts` construction sites
- `discovery.module.ts` — wires `settingsService.getOrgContext()` into orchestrator

### Org Context Encoded
Team: Simple.biz AI & Automation
Project types: Web App, Chrome Extension, n8n Workflow, Dashboard, CRM, SaaS
SP scale: 1, 2, 3, 5, 8, 13
Sprint structure: Current Sprint / Next Sprint / Backlog
GitHub repos: only for Web App, Chrome Extension, SaaS

### Tests
- `npm run typecheck` — pass
- `npm run build` — pass

**Handoff:**
- Org context defaults from the constant; admin can override via Settings → Workspace Context textarea
- All 5 OpenAI agents now receive the context — no mock agent changes needed (mocks use deterministic keyword logic)
- `getOrgContext` and `getConfidenceThreshold` are fetched in parallel before analysis in `runAnalysis`

---
## 2026-07-01 — QA Session (Standard Tier)

**Task**: `/qa` — Standard-tier QA: find and fix critical, high, medium bugs across all app flows.

**Issues found and resolved**:
- ISSUE-001 (high): Mock discovery agents polluted problem statement with short chat turns → filtered messages <15 chars
- ISSUE-002 (medium): Breadcrumb showed truncated intake ID → show title with 50-char truncation
- ISSUE-003 (by design): Evaluation tab empty in mock mode — IntakeEvaluation only created in orchestrator mode
- ISSUE-004 (medium): Steering guidance appended to scope bullets → moved to assumptions array
- ISSUE-005 (medium): "Approved By" shows `—` → added actorName to ApprovalRecord + fallback to actorId
- ISSUE-006 (high): Distribution Preview 400 (teamPrefix missing) → added teamPrefix state+input+API param
- ISSUE-007 (high): Discovery chat repeats identical keep_discovering response → floor tier at rough_frame after 2+ substantive messages; committed locally, push blocked by GitHub permissions
- ISSUE-008 (medium): Reports "Submitted" column always `—` → submittedAt doesn't exist, switched to createdAt + renamed column

**Infrastructure fixes**:
- CORS missing allowedHeaders → x-actor-* headers were stripped by browser, defaulting all requests to request_creator
- ActorProvider race condition → replaced useEffect with lazy useState for synchronous localStorage read

**Commits**: b30c8d8, 3378718, 7e42752, 5819994, 18fcb7d, 414bd0e (+ earlier session commits)
**Health score**: ~42 → 85/100
**Pending**: ISSUE-007 fix needs push to oreochiserver; discovery timeline sidebar events don't advance visually

---
## 2026-07-01 — TASK-0036: AI Provider Config — Blank Env Var Fix + Dev/Prod Model Defaults

**Status:** Complete

**Context**: Continuing the provider-agnostic AI layer from TASK-0015 — dev should default to OpenAI, Bedrock is preferred for staging/production, other providers stay routable via `AI_PROVIDER`.

**Bug found**: `loadAnalysisProviderConfig()` used `env["AI_PROVIDER"] ?? "mock"`. `??` doesn't catch empty strings, and the local `.env` had `AI_PROVIDER=` (present, blank) — so the app threw `ConfigurationError: AI_PROVIDER="" is not supported` at startup instead of defaulting to mock. Same gap existed for `OPENAI_MODEL`, `OPENAI_TASKS_MODEL`, `ANTHROPIC_MODEL`, `AWS_REGION`, `BEDROCK_MODEL_ID`, `BEDROCK_PREMIUM_MODEL_ID`, `BEDROCK_PROVIDER_MODE`.

**Fixed**:
- `src/application/providers/analysis-provider-config.ts` — added `nonEmpty()` helper treating blank/whitespace env values as absent; applied across all provider fields. Preserves TASK-0015's "no silent fallback" rule — an explicitly-set real provider still throws if its required key is missing.
- OpenAI default model: `gpt-4o-mini` → `gpt-5.5` (`analysis-provider-config.ts` + `llm-client-factory.ts` `resolveModel()`); `OPENAI_TASKS_MODEL` override example updated to `gpt-5.4-mini` — the analysis pipeline runs one full draft-generation call (classification + drafting + synthesis-adjacent reasoning), which per `docs/product/ai-cost-governance.md` warrants the higher-capability tier, not the cheapest.
- `model-cost-registry.ts` — added confirmed pricing for `gpt-5.5` ($5.00/$30.00), `gpt-5.4-mini` ($0.75/$4.50), `gpt-5.4-nano` ($0.20/$1.25) per 1M input/output tokens (source: developers.openai.com/api/docs/models/compare, checked 2026-07-01). `.env.example` documents `gpt-5.4-nano` as the manual cost-fallback option.
- Bedrock model IDs left required with no hardcoded default (account/region-specific; unsafe to guess).
- `.env` — removed dead `AI_LAYER_ENABLED` / `AWS_BEDROCK_MODEL_ID` (unread by any code); kept `AI_PROVIDER=mock` locally since no real `OPENAI_API_KEY` was available to add — documented the switch-to-`openai` path in a comment instead of fabricating a key.
- `.env.example` — clarified dev → openai, prod → Bedrock preferred, blank values now safely default.
- `tests/analysis-provider-config.test.mjs` — updated default-model assertion to `gpt-5.5`; added blank-`AI_PROVIDER`, blank-`OPENAI_MODEL`/`OPENAI_TASKS_MODEL`, blank-`BEDROCK_MODEL_ID`, and `OPENAI_TASKS_MODEL` override coverage.

**Tests**: `npm run build:core` pass · `npm run typecheck` pass · `analysis-provider-config.test.mjs` 16/16 pass · `ai-cost-governance.test.mjs` 24/24 pass · `npm test` 683/688 pass (5 pre-existing failures in `discovery-phase-3.test.mjs`, unrelated — workflow status default mismatch, no reference to files touched here).

**Task log**: `docs/ai/tasks/TASK-0036-ai-provider-config-blank-env-fix.md`

**Follow-up**: Re-verify Bedrock Claude model IDs in `.env.example` against the AWS Bedrock console before first live use. Q-COST-1 stays open — per-agent model tiering (lower-cost vs higher-capability split) is not yet implemented; the pipeline still runs as one uniform-model call.

---
## 2026-07-01 — TASK-0037: Discovery Engine AI Cost Reporting

**Status:** Complete

**Context**: Discovery Engine's real OpenAI agents (intent extraction, problem framing, solution generation, clarification, proposal composition) made live LLM calls but never logged token usage or cost anywhere — only the intake-evaluation pipeline (TASK-0015/TASK-0030) fed `/admin/ai-usage`. Asked to log discovery's cost into the same report.

**Built**:
- `DiscoveryAgentUsageRecord`/`DiscoveryAgentRole` (`src/domain/discovery.ts`) + `usageRecords?` on `DiscoverySession`.
- `DiscoveryAgentOptions.onUsage?` callback (`discovery-agent-contract.ts`); all 5 real OpenAI discovery agents now report `{agentRole, model, inputTokens, outputTokens, latencyMs}` after their LLM call (previously discarded the token counts already returned by `completeStructured()`).
- `DiscoveryOrchestrator` converts events → full records (cost via existing `model-cost-registry.ts`) at all 5 call sites that touch real agents, appending to `session.usageRecords` (accumulates across turns, doesn't overwrite).
- **Bug fixed in passing**: `discovery.module.ts`'s `buildOrchestrator()` never set `DiscoveryOrchestratorOptions.provider`, so every usage record would have been mistagged `provider: "mock"` regardless of the actual provider. Fixed.
- `IDiscoverySessionStore.listAllUsageRecords()` (+ shared `flattenDiscoveryUsage()`) on both `InMemoryDiscoverySessionStore` and `PrismaDiscoverySessionStore` — **no Prisma migration needed**, since `DiscoverySessionRecord.snapshot` already stores the whole session as `Json`.
- New global token `DISCOVERY_SESSION_STORE` (provided in `RuntimeModule`, not `DiscoveryModule`, to avoid a circular import with `AdminModule`) so `AiUsageController` can inject it directly.
- `AiUsageController`'s `listUsage` and `monthlySummary` merge evaluation + discovery usage before aggregating — `totalCostUsd`/`totalTokens`/`runCount`/`byModel`/`byAgentRole` now reflect both; added `bySource` breakdown; `byIntake` preserved (evaluation-only, discovery has no intakeId yet).
- UI: `/admin/ai-usage` gets a new "Cost by Source" table; `/reports`' AI Cost header gets an inline evaluation/discovery split. No other UI changes needed — both pages already render the merged totals generically.

**Tests**: `tests/discovery-usage-tracking.test.mjs` (5) + `tests/openai-discovery-agents-usage.test.mjs` (6) — all pass. `npm run build:core`, `npm run typecheck`, `npm run api:build`, `apps/web` typecheck + production build all pass. `npm test` 698/703 (same 5 pre-existing unrelated failures).

**Task log**: `docs/ai/tasks/TASK-0037-discovery-engine-ai-cost-reporting.md`

**Follow-up**: No automated controller-level test exists for `AiUsageController` (no controller tests exist anywhere in this codebase) — recommend a manual smoke check against a running API. `docs/product/requirements-trace.md` G-001 noted but not restructured (Discovery Engine predates/isn't modeled by Appendix G).

---
## 2026-07-01 — TASK-0038: Monday Board Schema Verification (docs-only)

**Status:** Complete

**Context**: User supplied `Dev-Operations-Manager-Guide.pdf` (Simple.biz AI & Automation Team manager's guide) as the authoritative source for Q-0005. Asked to derive the Monday board schema from it and classify Project Intake OS's own project type against it.

**Findings**: Code was already correct — `MondayProjectType` (`src/domain/discovery.ts`) and `SIMPLEBIZ_ORG_CONTEXT` (`org-context.ts`) already matched the guide's six-board Dev Operations Workspace closely (board hierarchy, sprint groups, quarter-based epics, 1/2/3/5/8/13 SP scale). The drift was in `docs/product/distribution-rules.md`, which listed an incomplete Project Type group set (`Web App / n8n Workflow / Dashboard / Process Change / Other`), missing `Chrome Extension`, `CRM`, `SaaS` that already exist in code.

**Fixed**:
- `docs/product/distribution-rules.md` — corrected Board 2 Project Type row to the real enum, cited the source PDF, noted Board 1 (Team Directory) is reference-only for the OS.
- `docs/ai/OPEN_QUESTIONS.md` — Q-0001 and Q-0005 were stale (both already answered by existing repo state); marked resolved with source notes.

**Classification**: Project Intake OS itself = **Web App** project type (Next.js + NestJS, internal, custom UI — matches `org-context.ts`'s own Web App definition verbatim). No code change; answered as classification only.

**Tests**: Docs-only change, no tests run.

**Task log**: `docs/ai/tasks/TASK-0038-monday-schema-verification.md`

**Follow-up**: Guide's "and more" caveat on Projects Portfolio groups (beyond the 6 named) is unconfirmed against the live board — left open rather than guessed. `PROJECT_TYPE_BY_INTENT` in `mock-manifest-generator-agent.ts` has no mapping to `Chrome Extension`/`CRM`/`SaaS` since Discovery's `IntentType` has no corresponding intent categories yet — not a bug, just unexercised.

---
## 2026-07-01 — TASK-0039: Open Questions Decision Pass (docs-only)

**Status:** Complete (decisions recorded; several need follow-up code changes)

**Context**: Worked through 21 open questions in `docs/ai/OPEN_QUESTIONS.md` with the user via multiple-choice prompts and recorded the resulting decisions.

**Resolved/deferred**: repo prefixes (no change), GitHub org (`Simple-biz`, tentative — unverified guess), private-by-default repos, keep monolith framework, email intake + Google Chat both deferred entirely, Google Auth going live (client ID to be set directly by admin), auth cookie fail-fast, per-target retry `maxAttempts`, no Chat notification on dead-letter/cancellation, scheduled-job backoff (v2), nginx-backstop rate limiting with flat tier, `gpt-5.5` confirmed live + admin-only cost visibility, DevOps-Lead-only completion authority, global `forbidNonWhitelisted`, 20-char minimum description length. Full table in `docs/ai/OPEN_QUESTIONS.md` and `docs/ai/tasks/TASK-0039-open-questions-decision-pass.md`.

**Also updated**: `docs/product/repository-and-naming.md` (Q-REPO-001/002/003) and `docs/product/post-distribution-lifecycle.md` (Q-LIFE-001) — duplicate open-question tables that mirrored the same underlying questions, now consistent with the central resolutions.

**Deliberately not implemented**: Q-AUTH-2 (auth startup behavior), Q-FAR-1/Q-FAR-3 (retry/dead-letter behavior, and Q-FAR-3 implies a new job-scheduling mechanism) fall under this repo's Safety Rules requiring explicit confirmation before editing auth/retry code — flagged rather than changed. Q-VAL-1/Q-VAL-2 are straightforward but also left for a follow-up implementation task since this pass was scoped as decision-recording only.

**Tests**: Docs-only change, no tests run.

**Task log**: `docs/ai/tasks/TASK-0039-open-questions-decision-pass.md`

**Follow-up**: Confirm real GitHub org handle before any live provisioning (current value is a placeholder guess). If the user wants code changes, split into (a) auth/validation follow-up (Q-AUTH-2, Q-VAL-1, Q-VAL-2) and (b) retry/backoff follow-up (Q-FAR-1, Q-FAR-3 — the latter needs a design call on what runs the scheduled job).

---
## 2026-07-01 — TASK-0039 Part 2: Implement Auth/Validation/Retry Decisions

**Status:** Complete (Q-FAR-3 deliberately not implemented — see below)

**Context**: User asked to proceed with implementing the code-affecting decisions from the Part 1 decision pass.

**Built**:
- Q-VAL-1 (global `forbidNonWhitelisted`) — already true in `apps/api/src/main.ts`; no change needed.
- Q-VAL-2 (20-char min intake description) — `MIN_INTAKE_DESCRIPTION_LENGTH` added to `validation-constants.ts`, applied to `CreateIntakeDto.description`. Updated `tests/input-validation.test.mjs`'s `validBase` fixture (was 19 chars, now under the new minimum) and added min-length test cases.
- Q-AUTH-2 (fail-fast on missing `AUTH_SESSION_COOKIE_NAME` under google mode) — added to `src/auth-config-validator.ts`, documented in `.env.example`, tests added/updated in `tests/auth-config-validator.test.mjs` (existing "accepts google" tests needed the var set explicitly since `npm test` doesn't load `.env`).
- Q-FAR-1 (per-target `maxAttempts`) — `AUTO_RETRY_MAX_BY_TARGET_KIND` map added to `intake-workflow-service.ts`; `executeWithAutoRetry` now resolves attempts via `executor.targetKind`. Empty map for now (no target has a different tolerance yet) — mechanism is in place.
- Q-FAR-3 (scheduled-job backoff) — **not implemented**. Explained why in the task log: it's a real feature (new persisted retry-timestamp, a scheduling mechanism — no `@nestjs/schedule`/BullMQ installed — and a changed result contract for in-flight retries), not a config tweak, and lands squarely in this repo's Safety-Rule-gated retry/dead-letter category. Flagged for its own scoped task.

**Incidental finding, then fixed**: `tests/rate-limiting.test.mjs` expects `aiEvaluation`/`inboundWebhook` tiers missing from `rate-limit.config.ts`'s working-tree state. Initially assumed pre-existing and spawned a background task; `git diff` showed both tiers exist at HEAD and were only missing from the uncommitted tree (accidental drop during in-flight TASK-0037 work) — withdrew the background task and restored the two tiers directly, matching HEAD exactly. Confirmed neither tier is wired to a `@Throttle()` decorator anywhere, same as at HEAD, so this is a config/test fix only, no runtime behavior change.

**Tests**: `npm run typecheck` (root + apps/web) pass · `npm run build:core` pass · `npm run api:build` pass · `node --test tests/*.test.mjs` — 5 pre-existing failures remain (discovery workflow-status-default mismatch, known since TASK-0036/37); the 6 rate-limiting failures are fixed. All auth-config-validator and input-validation tests pass including new cases.

**Task log**: `docs/ai/tasks/TASK-0039-open-questions-decision-pass.md` (Part 2 section)

**Follow-up**: `aiEvaluation`/`inboundWebhook` tiers are restored and tested but still unwired to any endpoint (true at HEAD too) — worth revisiting if those need their own throttle tier.

---
## 2026-07-01 — TASK-0039 Part 3: Q-FAR-3 Scheduled Background Retry (branch: feature/scheduled-retry-backoff)

**Status:** Complete

**Context**: User asked to continue with Q-FAR-3. Before building, checked the actual delay being avoided (~3s max, 3 attempts) against what "true v2" requires: the run has to stay `"executing"` until the background retry resolves, and the intake detail page doesn't currently poll for run status. Presented the tradeoff (full backend+frontend / backend-only with a UI gap / not worth building) — user chose full v2, on a separate branch since `main`'s working tree already carries unrelated uncommitted work. Created `feature/scheduled-retry-backoff`.

**Built** (no new dependency, no DB migration):
- `src/domain/provisioning.ts` — added `"pending_retry"` target status (safe: `status` is a plain Prisma `String` column, not an enum).
- `src/application/intake-workflow-service.ts` — replaced the blocking `executeWithAutoRetry` loop with `attemptOnce` + `executeTargetsAndFinalize` + `settleBackgroundRetry` (the detached `setTimeout`-based continuation) + a shared `finalizeProvisioningRun` extracted from the previously-duplicated tails of `executeDistribution`/`retryFailedProvisioningTargets`. Fixed a latent dead-letter double-counting risk uncovered while extracting the shared finalize logic (the old `+1` fudge assumed the current run was never persisted before the count — no longer safe once an interim `pending_retry` save can happen first; now excludes the current run's id explicitly instead).
- `apps/web/src/lib/types.ts` + `apps/web/src/app/intakes/[id]/page.tsx` — added `"pending_retry"` to the frontend status union, a "Retrying…" badge, and a polling `useEffect` (keyed on a derived boolean, not the runs array) that refreshes every 2s while any run is `"executing"`, stopping once settled.
- `tests/provisioning-scheduled-retry.test.mjs` (new) — custom transient-then-succeed executor proves: (1) the call returns in <500ms instead of blocking on backoff, (2) background settlement finalizes the run to `completed` and the intake to `distributed`, (3) exhausting all attempts finalizes to `failed`/`provisioning_failed`.

**Tests**: `tests/provisioning-execution.test.mjs` + `tests/provisioning-retry.test.mjs` (20 existing tests, unmodified) — all pass, confirming existing mock executors never exercised this path before or after (their failure messages don't match any auto-retryable category) — backs the "no behavior change for the common case" claim. New test file: 3/3 pass. Full suite: same 5 pre-existing discovery failures, nothing new. `npm run typecheck` (root + apps/web), `npm run build:core`, `npm run api:build`, `apps/web` production build — all pass.

**Task log**: `docs/ai/tasks/TASK-0039-open-questions-decision-pass.md` (Part 3 section)

**Follow-up**: Branch not yet merged to `main` — it carries all prior uncommitted session work too since nothing was committed before branching; needs a commit/merge decision before landing. Crash-durability of in-flight background retries is unchanged from the old blocking version (not a regression, not an upgrade either) — persisted `nextRetryAt` + sweep is the documented upgrade path if that gap ever matters.

---
## 2026-07-02 — TASK-0039 Part 4: Live Smoke Test on oreochiserver, Two Real Bugs Found and Fixed

**Status:** Complete

**Context**: Local browser verification of Q-FAR-3 was blocked by environment contention with another concurrent chat session (shared dev-server ports and shared `.next` build directory). User asked to SSH to oreochiserver and run the smoke test from there.

**Isolation**: cloned a separate checkout to `~/intake-os-qa` on the server rather than touch the live shared `~/intake-os` deployment (confirmed its containers were untouched throughout) — own Docker Compose project name, own ports (proxy on 8091), own throwaway Postgres. Tunneled back to this machine via `ssh -L` and drove the browser Preview tool against it.

**Bug 1 (pre-existing, not Q-FAR-3-specific)**: `PrismaProjectIntakeStore.saveIntake` never persisted `ProvisioningPlan`/`ProvisioningPlanAction` rows — only kept the plan as JSON in `recordSnapshot`. `ProvisioningRun.planId` is a real FK into `ProvisioningPlan`, so **every** real (Postgres-backed) distribution execution failed with `P2003: Foreign key constraint violated`. Invisible in `npm test` since it only exercises `InMemoryProjectIntakeStore`. Fixed: `saveIntake` now upserts `ProvisioningPlan` + its actions inside the same transaction, mirroring the snapshot pattern used elsewhere.

**Bug 2 (exposed by Q-FAR-3's new two-phase persistence)**: `saveProvisioningRun`'s target `update` block passed `errorMessage`/`externalId`/`externalUrl` through without `?? null` — Prisma treats `undefined` as "leave alone," not "clear," so a target that failed (persisted mid-retry) then later succeeded kept its stale error message. The old synchronous code never hit this since it only ever persisted a target once, with its final result. Fixed by adding `?? null` to match the pattern already used for `errorCategory`/`deadLetteredAt`/`completedAt`.

**Verified live**: reproduced both bugs on the QA deployment, fixed, redeployed, reverified — `distribution/execute` went 500→201; direct curl polling (0.3s intervals, to catch the mid-flight state faster than browser round-trips) showed the immediate `executing`/`pending_retry` response, 3 polls still `pending_retry`, then `completed`/`succeeded` with `errorMessage: null`. Frontend polling confirmed via network log (`GET .../distribution/runs` firing repeatedly after execute, stopping once settled).

**Cleanup**: QA stack fully torn down (`docker compose down -v`), clone directory removed, tunnel closed, both `.claude/launch.json` files (this repo's and the parent directory's, which the Preview tool actually reads) reverted.

**Tests**: `npm run typecheck`/`build:core`/`api:build` pass. `node --test tests/*.test.mjs` — same 5 pre-existing discovery failures, nothing new. No automated Prisma-integration test added for either bug (this repo has none today) — verified live instead.

**Task log**: `docs/ai/tasks/TASK-0039-open-questions-decision-pass.md` (Part 4 section)

**Follow-up**: Bug 1 predates this branch and likely affects the shared `~/intake-os` deployment too, independent of this PR, once its `api`/`postgres` containers restart — worth checking. No automated coverage for either fix; flag if this repo ever adds Postgres integration tests.

---
## 2026-07-02 — TASK-0040: Hardening Pass and Truth Sync (branch: feature/hardening-pass-truth-sync)

**Status:** Complete

**Context**: User supplied `project_intake_os_hardening_pass.md`, a document-only hardening plan (prepared 2026-07-01 against an uploaded snapshot) with 7 findings (F1–F7) and 6 implementation slices (A–F), and asked to implement it. Renumbered from the spec's own `TASK-0037` (already used this session for Discovery Engine AI Cost Reporting). New branch off `feature/scheduled-retry-backoff`, kept separate from that branch's open PR #1.

**Re-verified every finding against current code before implementing** rather than trusting the spec verbatim, since it predates several changes made earlier this session. Two findings had already been partially addressed (F5's `AUTH_SESSION_COOKIE_NAME` check); one was flatly wrong (F6 — real Prisma migrations already exist, just not used by the Docker startup command).

**Slice A (truth sync)**: Rewrote README's build-state table into honest status buckets (Built / Built mock-only / Built env-gated / Spec-ready not implemented) — Monday, GitHub, email intake, and Google Chat slash command were all listed as "Built — waiting for credentials" despite zero corresponding code existing. Removed two fictional API routes (`/intake-sources/email`, `/intake-sources/chat`) from the README's route table. Reworded `docs/EXTERNAL-NEEDS.md`'s items 4–7 from "already built" to "not implemented — code needed first." Full rewrite of `docs/ai/PROJECT_MEMORY.md`, which still claimed literally nothing was built (no DB, no UI, no auth, etc.) — years out of date.

**Slice B (env contract sync)**: Added 5 missing active vars + 12 rate-limit override vars to `.env.example`/`.env.server.example`. Removed 5 vars with zero code references anywhere (`DYNAMODB_JOB_STATUS_TABLE`, `AI_BATCH_SIZE`, `AI_BATCH_INTERVAL_SECONDS`, `AI_MAX_INPUT_CHARS`, `BITRIX24_WEBHOOK_URL`) — found beyond what the spec flagged. Moved Monday/GitHub credential vars into a clearly marked "not active" block, including replacing a real-looking `MONDAY_BOARD_ID` value with a blank. Renamed `API_PORT` → `PORT` to match what `main.ts` actually reads.

**Slice C (runtime guardrails)**: Wired `SWAGGER_ENABLED`/`SWAGGER_PATH` in `main.ts` (previously always mounted at a hardcoded path regardless of env). Added the missing `AUTH_GOOGLE_CLIENT_SECRET` check to `validateAuthConfig()`. Added `parsePositiveInt()` to `rate-limit.config.ts` so a bad (non-numeric/zero/negative) rate-limit env value falls back to the tier default with a warning instead of reaching `ThrottlerModule` as `NaN`. Added a one-line startup config summary log.

**Slice D (Discovery hardening)**: Added real DTOs (`DiscoveryMessageDto`, `AnswerClarificationDto`, `SelectDirectionDto`, `UpdateDiscoverySettingsDto`) replacing inline `{ message: string }`-style body types with zero validation — `UpdateDiscoverySettingsDto.orgContext` previously had no length bound at all despite being injected into every discovery agent's system prompt. Added `@Throttle` (reusing the existing-but-unused `aiEvaluation` tier) to the six discovery routes that can invoke a real LLM call. Converted 11 raw `throw new Error(...)` sites (not-found/invalid-state) to `NotFoundError`/`ValidationError` across the orchestrator and both session stores — deliberately left 2 "should never happen" defensive guards as raw `Error` (correctly 500, not a client error).

**Slice E (database release hardening)**: Switched `Dockerfile.api` from `prisma db push` to `prisma migrate deploy`. **Verified this before committing to it** using a disposable throwaway Postgres container — found real schema drift: the 5 tracked migrations didn't produce the same schema as `schema.prisma` (missing 4 lifecycle-status enum values and 3 dead-letter/retry columns, all previously applied only via local `db push`). Generated the missing migration, verified zero drift afterward. Without this check, switching to `migrate deploy` would have shipped a broken fresh-database deploy on the next real one.

**Slice F (verification)**: Full local suite passes (738 tests, same 5 pre-existing failures). Ran live governance-flow verification against a disposable Postgres+API stack (torn down after) using the repo's own smoke/benchmark scripts — `smoke:api` passed clean, but `smoke:runtime` **failed 9/19** on a pre-existing bug: the script sends a `decision` field the approval DTO doesn't accept, which `forbidNonWhitelisted` correctly rejects. Same stale field in `benchmark-governance-flow.mjs`. Fixed both scripts; re-ran clean (19/19, all governance guards pass). This bug predates the task entirely and had nothing to do with anything else in this pass — found only because Slice F insisted on actually running the demo path rather than assuming it worked.

**Tests**: `npm run typecheck`, `npm run build:core`, `npm run api:build`, `npm --prefix apps/web run build` all pass. `node --test tests/*.test.mjs` — 738 tests, 733 pass (same 5 pre-existing discovery failures). Live: `npm run smoke:api` 7/7, `npm run smoke:runtime` 19/19 (after the script fix), `npm run bench:governance` clean.

**Task log**: `docs/ai/tasks/TASK-0040-hardening-pass-truth-sync.md`

**One more finding after Slice F, before committing**: `git status`/`git ls-files` showed only `migration_lock.toml` tracked under `apps/api/prisma/migrations/` — every actual `migration.sql` (all 5 pre-existing, plus the new one from Slice E) was untracked. `.gitignore` had a bare `*.sql` rule (meant for local Postgres backup dumps) that also matched every migration file anywhere in the tree — same root-cause pattern as the `task-*.md` bug found in TASK-0039 (an unanchored glob meant for one location swallowing a different, legitimate one). This would have made the Slice E fix (`prisma migrate deploy`) non-functional on a real deploy: the actual flow is `git pull` then `docker build`, so a fresh pull would never bring the migration files regardless of what's on disk locally. Fixed by scoping the rule to `backups/*.sql`/`backups/*.dump`.

**Follow-up**: None blocking — all spec acceptance criteria met. Worth a future look: whether the schema drift found in Slice E (lifecycle-status enum values, dead-letter columns) also needs applying to the live shared `~/intake-os` deployment via `migrate deploy` next time its `api`/`postgres` containers restart — and now that migrations are actually tracked, `git pull` there will bring them.

## 2026-07-02 — TASK-0041: Land Hardening Pass on Main, Baseline Production Migrations, Self-Healing Cron

**Status:** Complete

Picked up the Slice E/F follow-up above. Found the hardening-pass commit had never actually reached `main` — PR #2 merged into `feature/scheduled-retry-backoff` two minutes *after* that branch was already merged into `main` via PR #1, so `main` (what oreochiserver tracks) stayed behind. Opened and merged PR #3 to close the gap (self-merge to `main` required explicit user go-ahead — blocked once by the auto-mode classifier without it).

While checking migration state on the live server, found `api`/`postgres` had been exited for ~24h (`web`/`local-proxy` still up) — logs showed a manual stop (graceful `postgres` shutdown + `SIGKILL` on `api`, same second), not a reboot. `restart: unless-stopped` (already configured) intentionally doesn't recover from an explicit stop. Data was intact; recovered via `docker compose up -d` (no config change).

Confirmed via direct schema inspection that production's actual database already matched `schema.prisma` exactly — the "drift" from TASK-0040 was real relative to the migration *files*, but production itself had already accumulated the same columns via years of `db push`. The real gap: `_prisma_migrations` had 0 rows. Shipping Slice E's `migrate deploy` switch as-is would have crash-looped the next deploy (tries to run all 6 migrations from scratch against a schema that already has them). Rebuilt the `api` image from `main`, baselined migration history via `prisma migrate resolve --applied` for all 6 migrations (metadata-only, run against a throwaway container — didn't touch the live `api` service until baseline was verified clean), then deployed. Confirmed clean boot ("No pending migrations to apply"), zero restarts, data intact, `/intakes` returns 200.

Added a `*/5 * * * *` + `@reboot` cron reconciler (`docker compose up -d`, idempotent) matching an existing convention already on that host — closes the actual gap that caused the outage (manual stop + no daemon restart = nothing brings it back without something watching).

**Task log**: `docs/ai/tasks/TASK-0041-production-deploy-and-self-healing.md`

**Follow-up**: None blocking — deploy/ops only, no application code changed.

## 2026-07-02 — TASK-0042: Service Token Auth for Non-Human Callers

**Status:** Complete

Follow-up to a question during TASK-0041: with only `dev_headers` (forbidden in production) and `google` (OAuth, still env-gated per GAP-007) as auth modes, none of the existing automation (`smoke-runtime-workflow.mjs`, `smoke-api.mjs`, CI) would be able to authenticate at all once Google auth is actually turned on — they only know how to send `x-actor-role`, which `google` mode rejects outright. User confirmed the fix should be an additional strategy alongside Google, not a replacement, scoped to non-human callers only (`integrations/bitrix24` explicitly excluded — not active dev).

Added `AUTH_SERVICE_TOKENS="name:token:role,..."` as a bearer-token check in `AuthGuard`, evaluated before the `AUTH_MODE`-specific branch so it works under either mode. Role comes only from server-side config, never from a client header — verified live that a token mapped to `request_creator` still resolves to `request_creator` even when the request also sends a spoofed `x-actor-role: admin` header. Unrecognized bearer tokens are rejected outright (401) rather than silently falling through to the mode-specific path.

Also fixed a stale, actively-wrong comment in `.env.server.example` ("Set to dev_headers for seeding/smoke scripts") — that file sets `NODE_ENV=production`, under which `AUTH_MODE=dev_headers` hard-crashes startup by design. Replaced with a pointer to `AUTH_SERVICE_TOKENS`.

**Tests**: `npm run typecheck` clean. `npm test` — 752 tests (14 new), 747 pass, 5 fail (same pre-existing discovery workflow-status-default failures, unchanged baseline). Live verification against a disposable local Postgres container + API instance (`AUTH_MODE=dev_headers` + `AUTH_SERVICE_TOKENS` set, torn down after): valid token → 200; unknown token → 401; no `Authorization` header → existing `dev_headers` behavior unaffected; created a real intake via a service token, confirmed audit trail attributed it correctly (`role` from server config, `displayName` from header); confirmed role can't be escalated via a spoofed header.

**Dual-mode follow-up (same day)**: user asked explicitly for confirmation that service tokens are additive, not a this-or-that choice with Google OAuth — added `tests/auth-guard-dual-mode.test.mjs` (6 tests, instantiates `AuthGuard` directly with a mock `SessionService`, no DB/DI needed) proving: under `AUTH_MODE=google`, a service token authenticates without ever calling `validateSession`, AND a request with no bearer token still validates via the real session-cookie path on the same running instance; same pair of checks for `AUTH_MODE=dev_headers`; an unrecognized bearer token is rejected even when a valid session cookie is also present on the same request; spoofed `x-actor-role` cannot escalate a lower-privileged token. This was already true by construction (the bearer check runs before the `AUTH_MODE` branch) — the tests make it a locked-in guarantee instead of an implementation detail.

**Task log**: `docs/ai/tasks/TASK-0042-service-token-auth.md`

**Follow-up**: `AUTH_SERVICE_TOKENS` is not yet set on oreochiserver (local-only verification in this task) — generating and setting real tokens there is a separate operator action. If this ever needs to serve external/multi-tenant callers, static tokens should be replaced with short-lived signed tokens.

## 2026-07-02 — TASK-0043: Fix Stale Discovery Test Assertions

**Status:** Complete

User asked for a proper state report rather than the repeated "5 known pre-existing failures" label. Traced each failure via its actual assertion output instead of trusting the existing description: 3 failures in `tests/discovery-phase-1.test.mjs` were message-count checks (`1≠2`, `2≠4`) that predate `DiscoveryOrchestrator.runAnalysis` appending an `"ai"`-role reply to session history after every turn. The other 2, in `tests/discovery-phase-3.test.mjs`, expected `status === "draft"` — `git log -p` on `proposal-to-intake-adapter.ts` showed this was deliberately changed to `"submitted"` in commit `1325c3e` ("auto-submit and auto-evaluate intake when sending discovery to evaluation"), and these two tests were never updated for it.

Both root causes are prior intentional product decisions, not regressions — fixed the 5 stale assertions (with a comment at each explaining why), no application code touched. Removed the two "5 known pre-existing failures" callouts from `README.md`.

**Tests**: `npm run typecheck` clean. `npm test` — **752/752 passing, 0 failures**, now that this fix is combined with TASK-0042's 14 new tests via rebase onto `main`.

**Task log**: `docs/ai/tasks/TASK-0043-fix-stale-discovery-tests.md`

**Follow-up**: None — suite is fully green.

## 2026-07-02 — TASK-0044: Service Tokens Provisioned on oreochiserver

**Status:** Complete

Generated one `AUTH_SERVICE_TOKENS` entry per canonical role (`svc-request-creator`, `svc-intake-owner`, `svc-devops-lead`, `svc-developer`, `svc-admin`, each `openssl rand -hex 32`) and appended them to `.env.server` on the live server. Restarting `api` showed no `[Auth] Service tokens configured` log line — the running image was still built from `d6693e7` (PR #3 only), predating PR #4/#5 which merged earlier in this same session, so the bearer-token code didn't exist in that image yet. With explicit go-ahead, pulled `main` and rebuilt: `prisma migrate deploy` still reported "No pending migrations to apply" (TASK-0041's baseline holds, no new migrations in PR #4/#5), zero restarts, data intact (16 intakes unchanged).

Verified live through the proxy's actual `/api/*` path (not bare `/intakes`, which routes to the web app on this Caddyfile) — valid admin token → 200, invalid token → 401 `AUTH_REQUIRED`, a distinct `request_creator` token authenticated as its own identity. Token values delivered to the user directly, never committed or logged anywhere.

**Task log**: `docs/ai/tasks/TASK-0044-service-tokens-provisioned.md`

**Follow-up**: Token values are the user's to store securely and wire into whichever scripts/CI need them.

## 2026-07-06 — TASK-0045 Step 1: Monday Config Schema + Validation

**Status:** In progress (Step 1 of 5 complete)

User provided the Dev Operations Workspace manager's guide PDF again alongside a reference to TASK-0045, flagging that Monday adapter wiring is still dead and we lack formal Monday API access. Confirmed this is the same PDF TASK-0038 already used to verify `MondayProjectType` against the actual board taxonomy — it documents board/column *concepts* (Team Directory, Projects Portfolio, Roadmap & Epics, Sprint Tasks, Credentials Vault, Microtasks & Ops), not real board/group/column IDs, so it cannot unblock `MONDAY_GROUP_ID` or `MONDAY_COLUMN_MAP_JSON` (those still require someone with real Monday access, per `HANDOFF-0023D-monday-credentials.md`).

Asked the user to choose scope; they picked implementing TASK-0045 Step 1 only — the one step that needs no credentials. Wrote `src/application/provisioning/monday-config.ts` (`validateMondayConfig()`), TDD (RED test first in `tests/monday-config.test.mjs`, confirmed failing on missing export, then implemented to GREEN). Validates presence of all four env vars (`MONDAY_API_TOKEN`, `MONDAY_BOARD_ID`, `MONDAY_GROUP_ID`, `MONDAY_COLUMN_MAP_JSON`), parses/validates `MONDAY_COLUMN_MAP_JSON` as a JSON object (rejects malformed JSON and non-object JSON like arrays), defaults `apiVersion` to `2026-04` from `MONDAY_API_VERSION`. Exported from `src/index.ts`. Added `MONDAY_GROUP_ID=` and `MONDAY_COLUMN_MAP_JSON=` (blank) to `.env.example`'s existing "not active" block so the full four-var shape is visible — still inert.

**Tests**: `npm run check` — typecheck clean, **761/761 passing** (9 new in `tests/monday-config.test.mjs`).

**Task log**: `docs/ai/tasks/TASK-0045-monday-adapter-build-plan.md`

**Follow-up**: Steps 2–5 (`monday-api-client.ts`, `monday-executor.ts`, runtime wiring, smoke script) remain blocked on `MONDAY_GROUP_ID`/`MONDAY_COLUMN_MAP_JSON` — need someone with real Monday board access to answer Q-M-1 through Q-M-6 in `HANDOFF-0023D-monday-credentials.md`.

## 2026-07-07 — TASK-0046: Unit Tests for PrismaDiscoverySessionStore Optimistic Concurrency

**Status:** Complete

`PrismaDiscoverySessionStore.update()` (`apps/api/src/persistence/prisma-discovery-session-store.ts`) uses optimistic concurrency (compare-and-swap on `updatedAt` via `updateMany`, retry up to 3 times, `ConflictError` on exhaustion) but had no test coverage — `apps/api` has no test harness at all, unlike `src/`'s `tests/*.test.mjs` suite built via `npm run build:core`. Confirmed no existing apps/api test pattern (`find apps/api -iname "*.test.*"` empty) before deciding an approach.

Followed the existing `tests/*.test.mjs` convention (import compiled `dist/` output, `node:test` + `node:assert/strict`, no mocking library) instead of introducing new tooling. Added `npm run test:api` (`api:build && node --test tests/api/*.test.mjs`) and placed the new test in `tests/api/` — a subdirectory the existing `npm test` glob (`tests/*.test.mjs`) doesn't match, so the default suite's build step stays untouched. `PrismaService` is mocked as a plain object with hand-rolled call-tracking functions (not `node:test`'s `mock.fn()`, to avoid version-specific API assumptions).

**Tests**: `tests/api/prisma-discovery-session-store.test.mjs` — normal update succeeds; retries 3x with a fresh re-read snapshot each attempt and succeeds on the 3rd; throws `ConflictError` when all 3 attempts return `count: 0`. `npm run test:api` — **3/3 passing**. `npm test` unaffected (745/769 passing; the 24 failures are pre-existing in `tests/provisioning-scheduled-retry.test.mjs`, unrelated to this change, not investigated).

**Task log**: `docs/ai/tasks/TASK-0046-prisma-discovery-session-store-tests.md`

**Follow-up**: Future apps/api persistence adapter tests belong under `tests/api/` using `npm run test:api`.

## 2026-07-07 — TASK-0047: Full Review Pass — GitHub Issues + Subagent Fixes

**Status:** Complete (PR not yet opened; Prisma migration for new indexes not yet generated)

Ran a full correctness/security/performance review (5 parallel specialist agents across
`apps/api`, `apps/web`, `src/`) on top of an earlier `ponytail-audit` (over-engineering
only, found an unused `packages/shared` scaffold and unused `class-transformer` dep — not
tracked as issues, left as a follow-up). Filed 22 GitHub issues (#6–#27) on
`Dusty043/intake-os`, 3 CRITICAL: `executeDistribution`/`retryFailedProvisioningTargets`
missing permission checks (any actor could trigger real provisioning), and the Bitrix24
intake endpoint being `@Public()` with client-forgeable actor headers and no DTO validation.
Also HIGH: IDOR across all Discovery session endpoints, unenforced audit-visibility tiers,
an unhandled-rejection risk in background provisioning retry, a TOCTOU double-provisioning
race, a lost-update race in discovery session storage, a stale-actor-closure UI bug, plus
several MEDIUM correctness/a11y items and 5 PERF items (N+1 writes, unbounded queries,
missing indexes, sequential-instead-of-parallel LLM calls).

Fixed all 22 via 10 parallel subagents on branch `fix/review-findings-batch-1`, each scoped
to non-overlapping files (one agent per file cluster; `intake-workflow-service.ts` got one
dedicated agent for its 6 issues). Full independent verification (not just per-agent
self-checks) caught what the agents' own checks missed: `npx tsc --noEmit` across all three
tsconfigs was clean, but the real test suite (`node --test tests/*.test.mjs`) showed 23
pre-existing tests failing — 21 needed a now-required `actor` argument added to
`getIntake`/`getAuditTrail` calls (mechanical, fixed directly across 10 test files), one
needed its assertion flipped to match the intentional new behavior (issue #17:
`updateProvisioningTargetResult` now throws `NotFoundError` instead of silently no-oping),
and one surfaced a real bug: the issue #6/#7 fix used `canTriggerProvisioning`/
`canRetryProvisioning` (`src/domain/permissions.ts`), which bundle the role check with
request-state checks, so an authorized `devops_lead` got a misleading `PermissionDeniedError`
instead of the correct `ValidationError` when the intake simply wasn't in the right state
yet. Per `CLAUDE.md`'s "ask before modifying authorization" rule, confirmed with the user,
then fixed by switching to this file's own established `ensurePermission(actor, action)`
pure-role-check convention (already used ~10 other places) in `executeDistribution`,
`retryFailedProvisioningTargets`, and `markReadyForProvisioning` (same latent bug,
pre-existing, same fix applied for consistency at the user's choice).

**Tests**: `npm run check` (typecheck + full suite) — **769/769 passing**, 0 failures.

**Task log**: `docs/ai/tasks/TASK-0047-security-review-fixes.md`

**Follow-up**: Open a PR (pending user decision on granularity). Generate a Prisma migration
for the 3 new `@@index([createdAt])` additions (`ProjectIntake`, `AgentRun`) against a live
dev DB — none available in this session. The Prisma-store TOCTOU mitigation for issue #13
narrows but doesn't fully close the race under READ COMMITTED — a
`CREATE UNIQUE INDEX ... WHERE status = 'executing'` migration is the real fix (documented
inline). Audit-visibility tiers `"assigned"`/`"operational"` remain unenforced — no
per-request assignee field exists to filter on (see Q-SEC-1). `ponytail-audit`'s findings
were not addressed here (different task scope).

## 2026-07-10 — TASK-0048 (T1 of Q-UX-1): DiscoveryStreamRegistry (branch: feat/discovery-live-streaming)

**Status:** Complete (T1 of 6 — registry only, not yet wired to anything)

Implementing Q-UX-1 (surface AI reasoning/progress during Discovery) per the eng-reviewed
design doc. That review's outside-voice pass (Codex) found the original plan's premise was
wrong — every Discovery LLM call is strict-schema JSON via a shared `completeStructured`
helper, so there's no free-form-prose step to stream cheaply, and the synchronous
`POST /message` pipeline had no way to connect to a separately-subscribed SSE stream. The
corrected plan's missing piece is a session-scoped event bus; built that in isolation first,
per the design doc's explicit Assignment, before touching the orchestrator or any agent.

Added `DiscoveryStreamRegistry` (`src/application/discovery/discovery-stream-registry.ts`) —
`subscribe`/`publish`/`hasSubscribers` over an in-memory `Map<sessionId, Set<listener>>`.
`publish()` on a session with no subscriber is a no-op (keeps future orchestrator wiring
simple — it can call `publish()` unconditionally). Multiple listeners per session are
supported by construction, covering the two-tabs-open case the outside-voice review flagged
as a correctness risk. 7 new unit tests cover no-op-when-unsubscribed, delivery, session
isolation, multi-listener fanout, scoped unsubscribe, cleanup-on-last-listener-leave, and
error-event delivery.

**Tests**: `npm run build:core` clean; `node --test tests/discovery-stream-registry.test.mjs`
— 7/7 passing; full suite `npm test` — 768/769 passing. The one failure
(`tests/monday-config.test.mjs`) is pre-existing, unrelated work-in-progress from a different
session (confirmed via `git stash` that it fails independent of this change).

**Task log**: `docs/ai/tasks/TASK-0048-discovery-live-streaming.md`

**Follow-up**: T2 (SSE controller + `requireOwnedSession` auth check + this repo's first
`*.e2e-spec.ts`), T3 (wire `stream: true` through `OpenAILlmClient.completeStructured`,
forwarding chunks into this registry, across all 6 Discovery agents), T4 (frontend
`fetch`+`ReadableStream` consumer, not `EventSource` — native `EventSource` can't carry this
app's `x-actor-*` auth headers), T5 (Caddy buffering config), T6 (heartbeat). The
`generateSolutions`/`planClarifications` concurrency decision (serialize vs. multi-indicator
UI) is still open and needed before T3.

## 2026-07-10 — TASK-0049 (T2 of Q-UX-1): SSE controller + auth + first NestJS e2e test (branch: feat/discovery-live-streaming)

**Status:** Complete (T2 of 6)

Decided the concurrency open question first: keep `generateSolutions`/`planClarifications`
concurrent (not serialized) — serializing would add real latency to every turn hitting that
path in exchange for a marginally simpler frontend model, which works against the whole
point of this feature. Frontend will track `activeStages: Set<string>` instead of one
`currentStage` string.

Added `GET /discovery/:id/stream` (`discovery.controller.ts`) using NestJS's `@Sse()`
decorator, gated by the same `requireOwnedSession` check every other `:id` route uses,
subscribing to T1's `DiscoveryStreamRegistry` (now registered as a module provider).

This repo had zero NestJS controller-level HTTP tests before this — existing API tests run
via `node --test` against compiled `dist/` classes, bypassing the HTTP/auth layer entirely.
Installed `@nestjs/testing` + `supertest` (new devDependencies) and wrote
`discovery-stream.e2e-spec.ts`: a minimal standalone testing module (not the full
`AppModule`, to avoid pulling in `PrismaService`/real DB via `AdminModule`) using the *real*
`AuthGuard` and `ApplicationExceptionFilter` — confirmed `AUTH_MODE=dev_headers` (this app's
default) never touches `SessionService`, so a stub there is safe without faking the auth
path itself. 3 tests: rejects a non-owned session (404), rejects a nonexistent session (same
404 — can't distinguish), and a full round-trip proving a real HTTP client receives events
published into the registry, correctly framed as named SSE events. The round-trip test uses
a `waitForSubscriber()` poll against the registry's own `hasSubscribers()` signal rather than
a fixed `setTimeout`, to avoid a timing-flaky test — verified stable across 5 repeated runs.
Added `api:test:e2e` npm script so this pattern is reusable for future controllers, not a
one-off.

**Tests**: `npm run api:build` + `npx tsc --noEmit -p apps/api/tsconfig.json` clean;
`node --test dist/apps/api/src/modules/discovery/discovery-stream.e2e-spec.js` — 3/3 passing
(x5 runs, no flakiness); full suite `npm test` — 768/769 passing, same pre-existing unrelated
failure as TASK-0048.

**Task log**: `docs/ai/tasks/TASK-0049-discovery-sse-controller.md`

**Follow-up**: T3 next — wire `stream: true` through `OpenAILlmClient.completeStructured`,
forwarding chunks into the registry, across all 6 Discovery agents (all strict-schema JSON,
no prose subset — see the design doc's outside-voice correction). T4 (frontend) can start in
parallel per the design doc's worktree lanes. Nothing publishes real events into the registry
yet — this task only proved the wire works end-to-end with test-published events.

## 2026-07-10 — TASK-0050 (T3 of Q-UX-1): wire real streaming through OpenAILlmClient (branch: feat/discovery-live-streaming)

**Status:** Complete (T3 of 6)

Made `OpenAiLlmClient.completeStructured` always stream internally (`stream: true` +
`stream_options: {include_usage: true}`), forwarding each `delta.content` fragment via a new
optional `onToken` param on `StructuredCompletionParams`. One implementation serves both
Discovery (which passes `onToken`) and the separate, out-of-scope evaluation pipeline (which
doesn't) — confirmed via grep this class has zero existing tests/mocks anywhere, so nothing
could break from the internal request-shape change; the external result contract is
identical either way.

`completeWithUsage` (`discovery-agent-contract.ts`, the single wrapper every real Discovery
agent calls) now brackets each call with `stage-start` → `token`\* → `stage-end` on success,
or `stage-start` → `error` (no `stage-end`) on throw — reusing T1's `DiscoveryStreamEvent`
type directly rather than a parallel shape. `DiscoveryOrchestrator` gained an optional
`streamRegistry`; `trackUsage` now takes a `sessionId` and wires `onStreamEvent` to
`registry.publish(sessionId, event)` across all 5 call sites (`runAnalysis`,
`generateSolutions`, `answerClarification`, `composeProposal`, `generateManifest`).
`discovery.module.ts` forwards the already-registered (T2) `DiscoveryStreamRegistry` into
the orchestrator.

No infra exists in this repo to unit-test the raw OpenAI SDK streaming loop (no seam to
inject a fake `OpenAI` client, and no existing test does this for the non-streaming path
either) — consistent with the rest of the codebase, tested at the `completeWithUsage`/
orchestrator layer instead with a fake `LlmClient`, which is where the actual new logic
(event bracketing, session-tagged forwarding) lives.

**Tests**: `npm run build:core` + `npx tsc --noEmit -p apps/api/tsconfig.json` clean;
`node --test tests/discovery-stream-wiring.test.mjs` — 5/5 passing; full suite `npm test` —
773/774 passing, same pre-existing unrelated failure; T2's e2e-spec re-verified 3/3 passing
after the `discovery.module.ts` changes.

**Task log**: `docs/ai/tasks/TASK-0050-discovery-stream-wiring.md`

**Follow-up**: T4 next — frontend `fetch`+`ReadableStream` consumer in `DiscoveryChat.tsx`,
replacing the static pulse. The backend now genuinely streams real content end-to-end; T4 is
the only remaining piece before a user can actually see it. T5 (Caddy buffering) and T6
(heartbeat) remain after that.

## 2026-07-10 — TASK-0051 (T4 of Q-UX-1): frontend stream consumer (branch: feat/discovery-live-streaming)

**Status:** Complete (T4 of 6 — core feature now fully wired end-to-end)

Resolved a UX fork the eng review flagged but left open: `token` events carry mid-stream
JSON fragments (all 6 Discovery agents are strict-schema JSON per T3), not prose, so
rendering them literally would look broken — decided with the user to show live stage
transitions only (`stage-start`/`stage-end` driven friendly labels), not raw streamed text.

Added `streamDiscoverySession()` (`discovery-client.ts`) — opens the T2 SSE route via
`fetch` (carries `actorHeaders()`, not `EventSource`), manually parses `event:`/`data:` SSE
frames from the raw `ReadableStream`. `discovery/[id]/page.tsx` opens one connection per
page view (persists across turns, matching the registry's session-scoped lifetime, not
request-scoped), tracked as `activeStages: Set<string>`. `DiscoveryChat.tsx`'s header
indicator now shows live per-stage labels (e.g. "Understanding your request…", or joined
when concurrent per the earlier concurrency decision) instead of a fixed string, falling
back to the old generic text when the stream hasn't reported anything (or failed) —
connection failure is silent by design, per the doc's progressive-enhancement requirement.

**Tests**: `apps/web` `npx tsc --noEmit` clean; `npx vitest run` — 14/14 passing (11
existing + 3 new for `streamDiscoverySession`: frame parsing, malformed-frame skip, non-OK
rejection); `npm run web:build` — production build + lint clean.

**Not verified in a live browser**: local Postgres (port 5432) is occupied by an unrelated
project on this dev machine, and seeing the actual live labels requires a real OpenAI
provider (`.env` has `AI_PROVIDER=mock` locally, under which mock agents never call
`completeWithUsage` — no stage events would fire). Did not switch to a real API key without
asking first.

**Task log**: `docs/ai/tasks/TASK-0051-discovery-frontend-stream-consumer.md`

**Follow-up**: T5 (Caddy buffering — without it, streamed chunks may arrive all-at-once
through the production proxy instead of live) and T6 (heartbeat — without it, long idle gaps
between stages could get the connection dropped) remain. The core feature (T1-T4) works
without them at reduced reliability; live-browser verification is deferred to either a
real-provider test environment or post-deployment.

## 2026-07-10 — TASK-0052 (T5+T6 of Q-UX-1): Caddy buffering + heartbeat — all 6 tasks complete (branch: feat/discovery-live-streaming)

**Status:** Complete — Q-UX-1's full implementation (T1-T6) is done

T5: added `flush_interval -1` to the API `reverse_proxy` block in `deploy/Caddyfile.server`
so SSE chunks flush immediately through the production proxy instead of buffering. No local
Caddy CLI on this machine — validated (and reformatted) using the same `caddy:2` Docker image
already pinned in `docker-compose.server.yml`.

T6: heartbeat implemented as a named `heartbeat` event on the same SSE Observable (not a raw
`: heartbeat\n\n` comment line as originally sketched — NestJS's `@Sse()`/`MessageEvent`
abstraction has no first-class support for comment-only frames, and going lower-level would
abandon the clean Observable pattern; a named event achieves the same keep-alive purpose,
and the frontend's event-type switch already no-ops on anything unrecognized). Fires every
15s for the connection's lifetime, torn down alongside the registry unsubscribe.

First test attempt used `node:test`'s fake timers (`t.mock.timers.enable` + `.tick(15_000)`)
— **this deadlocked the test process against the live HTTP stream** (had to `kill -9` it).
Documented as a dead end rather than silently dropped. Fixed by making the heartbeat interval
injectable (`@Optional() @Inject(DISCOVERY_STREAM_HEARTBEAT_MS_TOKEN)`, unused in production)
so the test uses a real-but-short 30ms interval instead.

**Tests**: `npm run api:build` + `npx tsc --noEmit -p apps/api/tsconfig.json` clean;
`node --test dist/apps/api/src/modules/discovery/discovery-stream.e2e-spec.js` — 4/4 passing
(3 from T2 + 1 new), x5 runs, stable; full core suite `npm test` — 773/774, same pre-existing
unrelated failure; `caddy validate` — Valid configuration.

**Task log**: `docs/ai/tasks/TASK-0052-discovery-stream-caddy-heartbeat.md`

**Follow-up**: All 6 implementation tasks done. Remaining before this ships: live-browser
verification with a real OpenAI provider (never done this session — local Postgres port
conflict + `.env` is `AI_PROVIDER=mock` locally), and opening a PR. 5 commits on
`feat/discovery-live-streaming`, all tests passing.

## TASK-0046 — folded in: PrismaDiscoverySessionStore optimistic-concurrency tests

A prior background session implemented `tests/api/prisma-discovery-session-store.test.mjs`
(3 tests covering the update()/updateMany compare-and-swap retry path — normal, retry, and
exhaustion-throws-ConflictError) but left it uncommitted, and the `test:api` script it
documented adding to `package.json` was never actually added. Added the missing script
(`"test:api": "npm run api:build && node --test tests/api/*.test.mjs"`) and committed the
test file + task doc on `feat/discovery-live-streaming`.

**Tests**: `npm run test:api` — 3/3 passing.

**Task log**: `docs/ai/tasks/TASK-0046-prisma-discovery-session-store-tests.md` (test-only,
no application code changed).
