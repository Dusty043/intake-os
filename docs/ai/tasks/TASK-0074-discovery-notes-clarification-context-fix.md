# TASK-0074 — Wire discoveryNotes into OpenAIClarificationQuestionsAgent

**Date**: 2026-07-17

## Bug report

After enabling live OpenAI (TASK-0073), a Discovery session ("Recipe Cost
Splitter") completed with zero clarification questions and high confidence
(0.8–0.98 across all dimensions) but sent an intake to evaluation whose
`discovery.notes` field explicitly listed 4 unresolved unknowns (ingredient
grammar, price table/currency, unit conversions, rounding rules). Evaluation
then blocked on `clarification_required` re-asking near-identical questions —
disrupting the Discovery→Intake handoff rhythm.

## Root cause

Two independently-tuned live LLM judgments never share context:

1. Discovery's confidence-scoring agent (problem framing) and its proposal
   composer (which writes the `notes` free-text unknowns) are separate model
   calls with separate prompts — nothing feeds the composer's unknowns back
   into confidence scores or a fresh clarification round.
2. `OpenAIClarificationQuestionsAgent` (intake evaluation) never read
   `ctx.discoveryNotes` — only `intake.title`/`description` and
   `priorClarifications`. This field is already fully plumbed through
   `evaluation-orchestrator.ts` → every agent's `AgentRunContext`, and
   `intake-workflow-service.ts:471` already populates it from
   `record.discovery.notes`. It just wasn't read here.
3. Since Discovery asked zero clarification questions, `priorClarifications`
   was empty, so the TASK-0061 safety net (`hasPriorAnswers` forcing
   `isBlocking=false`) never engaged either.

This exact gap was flagged and deliberately scoped out during TASK-0061 as
Q-DISC-1 in `docs/ai/OPEN_QUESTIONS.md`, noted as "not a correctness bug"
because it hadn't been exercised under live AI yet.

## Fix

[openai-clarification-questions-agent.ts](../../../src/application/agents/openai/openai-clarification-questions-agent.ts):
appends `ctx.discoveryNotes` to the user prompt under a "Notes from discovery"
section, with a system-prompt instruction to treat those as known open items
rather than fresh blocking gaps. Deliberately does NOT force `isBlocking`
false from `discoveryNotes` alone (only `priorClarifications`, i.e. actually
answered questions, does that) — notes are unstructured and may themselves
say something is still unresolved, so the model retains judgment.

## Tests

`tests/openai-clarification-questions-agent.test.mjs` — 2 new tests:
- discoveryNotes are included in the prompt sent to the model
- discoveryNotes alone do not force `isBlocking=false` (only priorClarifications does)

`npm run build:core` clean. `npm test` — 797/797 pass.

## Follow-ups

- Q-DISC-1 in OPEN_QUESTIONS.md still open: the other 12 evaluation agents
  also ignore `discoveryNotes`/`priorClarifications` — out of scope here,
  same as TASK-0061.
- Not yet re-verified against a live Discovery→Intake run end-to-end this
  session — next session should redo the Recipe Cost Splitter flow (or
  similar) to confirm evaluation no longer re-blocks on notes-only unknowns.
