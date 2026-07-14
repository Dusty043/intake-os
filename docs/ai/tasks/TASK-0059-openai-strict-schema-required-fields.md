# TASK-0059 — Real evaluation pipeline stuck at "evaluating": OpenAI strict-schema violation

## Request

User: "can you take a look at the last run?-- it still didnt run to the ai
draft / eval stage" — after the TASK-0057/0058 deploy, the most recent
production intake was stuck.

## Investigation

Queried the production database directly (read-only): the most recent intake
(`intake-mrl41883-15`, created 2026-07-14 20:34:58) was stuck in status
`evaluating` — `updatedAt` was 71ms after `createdAt`, and its audit trail had
exactly one event (`generate_evaluation: submitted → evaluating`), nothing
after. Several older intakes (from 2026-07-10) were stuck the same way,
confirming this predates today's deploy.

Grepped production API logs (filtered to error-level lines only, redacting
anything resembling secrets, per the session's read-only production-access
constraint) for the stuck intake's ID:

```
WARN [DiscoveryHttpController] Auto-evaluation failed for intake
intake-mrl41883-15: Error: 400 Invalid schema for response_format
'clarification_questions': In context=('properties', 'questions', 'items'),
'required' is required to be supplied and to be an array including every key
in properties. Missing 'suggestedAnswerFormat'.
```

This is caught by the existing `.catch()` around the fire-and-forget
auto-evaluation call in `discovery.controller.ts` (logs a warning, doesn't
crash) — so the intake silently sticks at `evaluating` forever with no user-
visible error and no retry.

## Root Cause

Production runs `AI_PROVIDER=openai` with the real orchestrator
(`generateEvaluation`), unlike local dev (`AI_PROVIDER=mock`). Every OpenAI
agent's structured-output request sets `strict: true`
(`openai-llm-client.ts:25`). OpenAI's Structured Outputs mode requires **every
key in a schema's `properties` to also appear in `required`** — optional
fields are expressed by making the type nullable (`["string", "null"]`), not
by omitting the key from `required`. `OpenAIClarificationQuestionsAgent`'s
inner `questions[]` schema listed `suggestedAnswerFormat` in `properties` but
not in `required`, so OpenAI rejected the schema outright with a 400 before
generating anything.

Audited all 13 OpenAI agent schema files for the same pattern (every
`properties` key present in the corresponding `required` array, at every
nesting level) and found it was systemic, not isolated to one agent:

| Agent | Field(s) missing from `required` |
|---|---|
| `openai-clarification-questions-agent.ts` | `suggestedAnswerFormat` |
| `openai-cost-effort-agent.ts` | `estimatedEngineeringDays` |
| `openai-distribution-planner-agent.ts` | `monday.suggestedBoard`, `monday.suggestedGroup`, `monday.itemName`, `github.repositoryName` |
| `openai-project-classifier-agent.ts` | `projectSubtype` |
| `openai-solutions-architect-agent.ts` | `architectureStyle` |
| `openai-work-breakdown-agent.ts` | `estimatedHours`, `suggestedOwnerRole` |

Every one of these fields is genuinely optional in the corresponding TS
domain type in `intake-evaluation.ts` (`field?: T`) — this wasn't a case of
the field actually being required and the schema under-specifying it; the
schemas were just written before the strict-mode "every key must be listed,
nullable for optional" rule was understood/applied.

The other 7 agents (`critic-qa`, `custom-build`, `final-synthesis`,
`intake-analyst`, `low-code-path`, `risk-security`) already had every
property listed in `required` — no bug there.

## Fix

For each of the 6 affected schemas: added the missing key(s) to the relevant
`required` array and changed that field's type to `["<type>", "null"]`
(OpenAI's documented pattern for an optional field under `strict: true`).
Verified every downstream consumer of these fields uses a null-safe check
(`!!x`, `x != null`, or `x ?? default`) — none does a strict `=== undefined`
comparison that `null` would break.

## Testing

- `npm run typecheck` (core) — clean.
- `npm test` — 785/785 pass, no regressions (no existing unit tests directly
  exercise these OpenAI agent schemas against a real API — they require a
  live OpenAI call to trigger the 400, which is why this shipped undetected).
- Not yet re-verified live in production against the real OpenAI endpoint
  (would require triggering a new evaluation run post-deploy) — recommend
  the user re-run a Discovery → Send to Evaluation flow after this deploys
  and confirm the stuck-intake pattern doesn't recur.

## Not Changed

- Did not add a retry mechanism for intakes already stuck at `evaluating`
  from before this fix (e.g. `intake-mrl41883-15` and the four from
  2026-07-10) — they'll stay stuck until manually re-triggered or a retry
  path is built. Out of scope for this fix; flagged as Q-EVAL-1 below.
- Did not add an automated regression test asserting schema
  required/properties consistency across all OpenAI agents (would have
  caught this bug and prevents recurrence for future agents) — logged as a
  follow-up given session scope/cost constraints, not because it isn't
  worth doing.

## Follow-up

- Q-EVAL-1 (new): intakes stuck at `evaluating` from a failed real-evaluation
  call have no user-visible error and no retry path — the fire-and-forget
  `.catch()` only logs a warning server-side. Needs a product decision on
  whether to transition back to `submitted` on failure (matching the
  existing `evaluation_failed` transition already defined in
  `workflow.ts`) so the user can retry from the UI, versus building a
  dedicated stuck-evaluation admin recovery tool.
- Consider a schema-consistency lint/test across all OpenAI agent files to
  prevent this class of bug recurring.
