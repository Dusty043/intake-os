# TASK-0076 — Surface unconfirmed discovery assumptions to Intake

**Date**: 2026-07-17

## Context

User feedback: "proceeding with current assumptions is too weak... since
we're using ai anyway bridge the gap to take the safest road to the goal."

Investigation found a concrete gap: `proposal.assumptions` — things the
problem-framing/proposal-composer agents guessed on the user's behalf
without ever asking (populated when the confidence tier is
`propose_with_assumptions`, 0.66–0.80, or when the user explicitly signals
"wing it" / "you decide" via the `PROCEED_RE` regex in `runAnalysis`) —
were silently dropped when building the intake record.
[proposal-to-intake-adapter.ts](../../../src/application/discovery/proposal-to-intake-adapter.ts)
only folded `proposal.unknowns` into `discovery.notes`; `proposal.assumptions`
never reached it. That means neither Intake's clarification agent
(TASK-0074, reads `discoveryNotes`) nor the final clarification-check gate
(TASK-0075, reads the same field) ever saw what had been assumed — an
assumption-heavy proposal could sail through both checks with zero AI
scrutiny, since assumptions by definition aren't stated as open questions
anywhere else in the title/description.

## Change

[proposal-to-intake-adapter.ts](../../../src/application/discovery/proposal-to-intake-adapter.ts):
`discovery.notes` now includes assumptions as a second, distinctly-labeled
paragraph alongside unknowns: `"Unconfirmed assumptions discovery made
without asking the user: ..."` vs the existing `"Open unknowns from
discovery: ..."`. The two are semantically different — unknowns carry a
recommended default discovery already reasoned about; assumptions are
unverified guesses — so they need different downstream handling, not just
concatenation.

[openai-clarification-questions-agent.ts](../../../src/application/agents/openai/openai-clarification-questions-agent.ts):
`SYSTEM` prompt updated to explain the two labels distinctly. Unknowns:
treat as already resolved, don't re-block (unchanged from TASK-0074).
Assumptions: take the safest road — if consequential (cost, data handling,
scope, architecture), turn into a clarifying question rather than silently
accept it.

## Scope notes

- Mock provider path (`MockClarificationQuestionsAgent`) still doesn't read
  `discoveryNotes` at all (Q-DISC-1, unchanged) — this fix only changes
  behavior under live AI, which is what the user's request was about
  ("since we're using ai anyway").
- Did not touch the `propose_with_assumptions` confidence tier itself or the
  "wing it" escape valve in `runAnalysis` — that mechanism is a deliberate
  UX feature (comment: "so the session doesn't loop asking questions") and
  changing it would reintroduce the friction it exists to avoid. Instead,
  the fix ensures whatever gets assumed there is later surfaced to the AI
  checks that already exist, rather than changing when assumptions get made.

## Tests

`tests/proposal-to-intake-adapter-assumptions.test.mjs` (new, 3 tests):
- assumptions + unknowns both present, distinctly labeled
- neither present → `notes` is `undefined`
- only assumptions present → correct label, no unknowns label

`npm run build:core`, `npm run typecheck`, `npm run api:build` clean.
`npm test` — 805/805 pass (3 new).

## Follow-ups

- Not yet re-verified live. Next session: run a session through the
  `propose_with_assumptions` tier or "wing it" path live and confirm the
  assumptions actually surface as a clarifying question at Intake/Discovery
  handoff when consequential.
- Q-DISC-1 still open (mock path, other 12 agents).
