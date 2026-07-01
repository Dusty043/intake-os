# TASK-0038 — Monday Board Schema Verification

## Status: Complete

## Objective

User supplied `Dev-Operations-Manager-Guide.pdf` (Simple.biz AI & Automation Team manager's guide, prepared by Cob) as the authoritative source for Q-0005 (Monday board/group/column schema). Verify `docs/product/distribution-rules.md` and the existing `MondayProjectType` implementation against it, fix any drift, and classify Project Intake OS itself under the confirmed project-type taxonomy.

## Findings

- The guide confirms the **Dev Operations Workspace**: six linked boards — Team Directory, Projects Portfolio, Roadmap & Epics, Sprint Tasks, Credentials Vault, Microtasks & Ops.
- `src/domain/discovery.ts`'s `MondayProjectType` and `src/application/discovery/agents/org-context.ts`'s `SIMPLEBIZ_ORG_CONTEXT` already matched this schema closely (sprint groups, quarter-based epics, SP scale 1/2/3/5/8/13, board hierarchy) — no code change needed.
- `docs/product/distribution-rules.md` had drifted: its "Project Type (group)" row for Board 2 (Projects Portfolio) listed only `Web App / n8n Workflow / Dashboard / Process Change / Other`, omitting `Chrome Extension`, `CRM`, and `SaaS` — all of which already exist as valid `MondayProjectType` values in code. Doc did not reflect the real enum.
- Q-0001 and Q-0005 in `docs/ai/OPEN_QUESTIONS.md` were stale — both asked questions the repo had already answered (the file exists; the schema was already implemented) but were never marked resolved.

## What Changed

- `docs/product/distribution-rules.md` — corrected the Board 2 Project Type row to reference the real `MondayProjectType` enum, cited the source PDF, added a short note on Board 1 (Team Directory) being reference-only, and flagged that the guide's "and more" (groups beyond the 6 named) is unconfirmed against the live board.
- `docs/ai/OPEN_QUESTIONS.md` — marked Q-0001 and Q-0005 resolved with notes on what confirmed them.

## Project Type Classification (user's second question)

Project Intake OS itself, classified under the confirmed Monday taxonomy: **Web App** — matches `org-context.ts`'s own definition verbatim ("React/Next.js web applications, client portals, internal apps with custom UI"). It is a NestJS API + Next.js web frontend, internal-only, custom UI — not a Chrome Extension, not an n8n Workflow, not read-only (Dashboard), not contact/pipeline tooling (CRM), and not multi-tenant/externally-distributed (SaaS). No code change needed for this — answered as a classification, not a defect.

## Tests

Docs-only change. No code touched; no tests run.

## Follow-up / Open Items

- The guide's "and more" caveat on Projects Portfolio groups is unconfirmed — if the live board has groups beyond Web App/Chrome Extension/n8n Workflow/Dashboard/CRM/SaaS, `MondayProjectType` and the intent→type mapping in `mock-manifest-generator-agent.ts` may need extending. Left open rather than guessed.
- `PROJECT_TYPE_BY_INTENT` in `mock-manifest-generator-agent.ts` has no mapping to `Chrome Extension`, `CRM`, or `SaaS` — Discovery's `IntentType` taxonomy has no corresponding intent categories yet. Not a bug (falls back to `Other`), but worth revisiting if those project types start appearing in real intakes.
