# TASK-0060: Fix stale Monday board/group names in MockDistributionPlannerAgent

**Status:** Complete
**Date:** 2026-07-16

## Context

User asked to confirm the criteria Intake OS uses to route a request to
GitHub+Monday provisioning vs. Monday-only. While confirming the criteria against
`docs/product/project-type-registry.md` and `docs/product/distribution-rules.md`,
found that `src/application/agents/mock/mock-distribution-planner-agent.ts`
(`distribution_plan` mock agent, used by the intake-evaluation pipeline) predated
the Q-0005 Monday schema correction:

- `inferMondayBoard` invented board names ("Software Development Board",
  "AI/Automation Projects Board", "Infrastructure Board", "Design & Product Board")
  that don't exist in the real Dev Operations Workspace (6 boards documented in
  `distribution-rules.md`). The live `OpenAIDistributionPlannerAgent` already
  correctly hardcodes "Projects Portfolio" via its system prompt — only the mock
  was stale.
- `inferMondayGroup` used made-up group names instead of the `MondayProjectType`
  enum (`src/domain/discovery.ts`) that Board 2 (Projects Portfolio) actually uses:
  Web App, Chrome Extension, n8n Workflow, Dashboard, CRM, SaaS, Process Change, Other.

## Change

- Removed `inferMondayBoard`; `suggestedBoard` is now the constant `"Projects Portfolio"`,
  matching the live OpenAI agent and `distribution-rules.md`.
- Rewrote `inferMondayGroup`'s lookup table to map each `ProjectType` enum value to a
  real `MondayProjectType` group instead of an invented name. Best-effort mapping where
  no clean 1:1 exists (`api_service`, `ai_workflow_tool`, `data_sync_integration`,
  `discovery_research` → `"Other"`) — flagged to the user as a follow-up decision, not
  guessed silently.

## Tests

Added 3 cases to `tests/mock-evaluation-agents.test.mjs` under the existing
`describe("MockDistributionPlannerAgent")` block:
- `monday.suggestedBoard` is always `"Projects Portfolio"`
- `monday.suggestedGroup` maps `n8n_automation` → `"n8n Workflow"`
- `monday.suggestedGroup` falls back to `"Other"` for unmapped types (`api_service`)

`npm run build:core` clean. `node --test tests/mock-evaluation-agents.test.mjs` —
83/83 pass, no regressions.

## Open follow-up (not resolved this task)

User's real-world intake categories ("webapp, chrome extension, custom n8n node,
automation (mostly n8n, broad), system") don't map cleanly onto either existing
taxonomy:
- `ProjectType` (10 values, drives GitHub requirement + eval depth + distribution mode)
- `MondayProjectType` (8 values, drives Board 2 group only)

User was unsure how to narrow the GitHub-required default for the 3 `optional` types
(Data Sync/Integration, Internal Dashboard, Reporting Automation). Proposed but not yet
confirmed: a "does this require a maintained codebase outside n8n/Monday" test rather
than the current broad keyword heuristic (`code|app|build|develop|engineer`) in
`determineGithubRequired`, which over-triggers (e.g. "build a dashboard" → GitHub yes
even though Internal Dashboard is `optional`). Needs explicit confirmation before
touching registry/classifier logic per CLAUDE.md.
