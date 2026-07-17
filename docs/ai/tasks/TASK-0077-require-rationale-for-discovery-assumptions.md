# TASK-0077 — Require rationale for every discovery assumption

**Date**: 2026-07-17

## Context

Follow-up to TASK-0076. User feedback: "rationale must be provided-- not
just assumptions. the ai is solving the gap between what is known and not.
and providing a safe way to achieve it."

TASK-0076 surfaced `proposal.assumptions` to Intake, but each assumption was
still a bare string (e.g. `"Assuming this is for internal staff only."`) —
a claim with no stated reasoning. That's not enough for Intake's
clarification agent (or a human reviewer) to judge whether the assumption
is safe to accept or needs confirming.

## Change

Introduced a shared domain type in
[domain/discovery.ts](../../../src/domain/discovery.ts):

```ts
export interface DiscoveryAssumption {
  assumption: string;
  rationale: string;
}
```

`ProblemFrame.assumptions` and `ProjectProposal.assumptions` both changed
from `string[]` to `DiscoveryAssumption[]`. Every producer and consumer of
assumptions was updated to match:

- **Producers**: `openai-problem-framing-agent.ts` and
  `openai-proposal-composer-agent.ts` — JSON schemas widened so `rationale`
  is `required` and `additionalProperties: false` (the model literally
  cannot omit it, matching the codebase's existing pattern for required
  "reason"/"rationale" fields elsewhere, e.g. clarification questions'
  `reason`). System prompts updated to instruct the model: state both the
  assumption and *why* it's the safe (reversible, low-risk, correctable)
  choice, never omit rationale. `mock-problem-framing-agent.ts` synthesizes
  a rationale for its one conditional (solution-bias) assumption.
- **Consumers**: `mock-proposal-composer-agent.ts` (maps assumption text
  into the unrelated `ProblemFrameSection.constraints: string[]` field),
  `mock-manifest-generator-agent.ts` (README rendering), `discovery-orchestrator.ts`
  (`buildAnalysisReply` — the "I'm moving forward with a few assumptions"
  chat message now shows the rationale too), `proposal-to-intake-adapter.ts`
  (TASK-0076's `discovery.notes` string now renders `assumption (Rationale:
  ...)` per item), `apps/web/src/lib/discovery-types.ts` (frontend type
  mirror — no component currently renders assumptions, so no UI changes).

## Tests

- `tests/discovery-phase-1.test.mjs`: new test confirming
  `MockProblemFramingAgent`'s solution-bias assumption has non-empty
  `assumption` and `rationale`.
- `tests/proposal-to-intake-adapter-assumptions.test.mjs`: updated fixtures
  to the new shape; assertions extended to confirm rationale text reaches
  `discovery.notes`.

`npm run build:core`, `npm run typecheck`, `npm run api:build`, and
`npm --prefix apps/web run build` all clean. `npm test` — 806/806 pass.

## Follow-ups

- Not yet re-verified live — next session should confirm a live OpenAI
  proposal composition call actually returns `{assumption, rationale}`
  pairs (schema enforcement should guarantee this, but worth a real check).
- Q-DISC-1 still open (unrelated — other evaluation agents ignoring
  discoveryNotes).
