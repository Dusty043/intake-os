# TASK-0061: Fix Discovery-originated intakes re-blocking at evaluation (no draft, wrong stage)

**Status:** Complete
**Date:** 2026-07-16

## Request

User reported (after confirming the TASK-0059/TASK-0060 fixes were deployed):
"discovery is broken--- and it creates the intake properly but not at the proper
stage and the pushback existed in the intake not the discovery. it doesnt create
ai draft properly."

Investigated via `superpowers:systematic-debugging` (root-cause phases), not guessing.

## Root Cause

`src/application/agents/openai/openai-clarification-questions-agent.ts` never read
`ctx.priorClarifications` or `ctx.discoveryNotes` — it built its prompt from only
`intake.title`/`intake.description` and returned the model's raw `isBlocking` verdict
unmodified. Grepped all 13 OpenAI evaluation agents: **zero** reference either field —
this systemic gap (same "N of 13 agents missing a rule" shape as TASK-0059) means no
OpenAI evaluation agent is aware of anything Discovery already resolved.

`src/application/agents/mock/mock-clarification-questions-agent.ts` already encodes
the correct product rule (line 82-84): *"Prior clarification answers resolve blocking
questions — treat as non-blocking."* The OpenAI agent was never updated to match when
it was built, so production (which runs real OpenAI agents per `AI_PROVIDER=openai`)
never had this guarantee.

Traced the failure chain in `evaluation-orchestrator.ts` (`orchestrate()` lines
182-213): when `clarResult.output.isClarificationBlocking === true || clarContent.isBlocking
=== true`, the orchestrator returns `{ kind: "clarification_required" }` and **never
reaches the draft/synthesis stage** — the intake transitions to `clarification_needed`
instead of proceeding toward `intake_review`. This single mechanism explains all three
symptoms in the report:
1. "not at the proper stage" — lands at `clarification_needed` instead of `intake_review`.
2. "the pushback existed in the intake not the discovery" — the clarification agent
   re-derives blocking-ness from a thin title+description, ignorant that Discovery
   already asked and answered these exact questions.
3. "doesn't create ai draft properly" — when blocked, no draft is ever generated;
   the orchestrator short-circuits before synthesis.

## Fix

`openai-clarification-questions-agent.ts`:
- Prompt now includes an "Already answered during discovery" section built from
  `ctx.priorClarifications` (Q/A pairs), so the model has that context.
- Added the same deterministic override the mock agent already has: if
  `ctx.priorClarifications` is non-empty, `isBlocking` is forced to `false`
  regardless of what the model returns — matching product intent exactly rather
  than hoping the LLM infers it reliably from prose.
- Also now sets `isClarificationBlocking` on the `AgentOutput` (previously omitted;
  the orchestrator fell back to `clarContent.isBlocking` only).

## Tests

New file `tests/openai-clarification-questions-agent.test.mjs` (3 cases, stub
`LlmClient` pattern matching `tests/openai-discovery-agents-usage.test.mjs`):
- passes through `isBlocking=true` unchanged when there are no prior clarifications
- forces `isBlocking=false` when priorClarifications exist, even if the model says true
- prompt sent to the model includes the prior Q&A text

Verified red→green: ran the 2nd/3rd tests against the pre-fix code first (failed as
expected), then rebuilt and confirmed pass. `npm run build:core` clean.
`npm test` — 791/791 pass (788 pre-existing + 3 new), no regressions.

## Not Changed

- Did not add `discoveryNotes`/`priorClarifications` wiring to the other 12 OpenAI
  evaluation agents. The user's reported bug is specifically about the clarification
  re-block; widening every agent's prompt to include full discovery context is a
  larger, separately-scoped quality improvement, not what broke here. Logged as
  Q-DISC-1 below.

## Follow-up

- Q-DISC-1 added: no OpenAI evaluation agent besides `clarification_questions`
  reads `ctx.discoveryNotes`/`ctx.priorClarifications` — draft quality for
  Discovery-originated intakes may still be generic since agents like `intake_brief`,
  `classification`, `architecture`, etc. never see the fuller discovery context that's
  already threaded into `AgentRunContext`. Not a correctness bug (nothing crashes or
  mis-blocks), just an unrealized quality opportunity.
