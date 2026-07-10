# TASK-0055 — Discovery → Intake handoff: "didn't transfer well"

## Request

User reported the Discovery → Intake handoff "didn't transfer well" after
reviewing a created intake. Investigated the actual data rather than
guessing.

## Context Read

- `docs/product/ai-orchestration.md` — confirmed a separate downstream
  **Work Breakdown Agent** is the designated, authoritative source of
  epics/stories during Evaluation. Discovery's `proposal.suggestedEpics` is
  explicitly a rough scaffold, not meant to be the final breakdown — ruled
  out copying it wholesale into the intake record as conflicting with that
  boundary.
- `docs/product/intake-analysis-schema.md` — confirmed the mock
  intake-analysis provider is documented as deterministic/canned by design
  ("does not call a live model provider"), so generic mock subtasks on the
  created intake are expected mock behavior, not a bug.
- `src/application/discovery/proposal-to-intake-adapter.ts`,
  `discovery-orchestrator.ts`, mock discovery agents.

## Findings

Fetched the actual intake record created from a real Discovery session and
found three concrete, confirmed **mock-agent-only** bugs (verified the real
OpenAI-backed agents don't share them — the LLM generates title/epics
directly) plus one **real, structural** gap:

1. **Title truncated mid-word.** `mock-proposal-composer-agent.ts` used
   `.slice(0, 60)` / `.slice(0, 80)` with no word-boundary awareness —
   produced titles like "...and not" instead of "...and notify ops 30 days
   before expiry."
2. **Fake epics.** `suggestedEpics` was `selected.dependencies.map(d =>
   \`Epic: ${d}\`)` — dependencies (e.g. a solution's prerequisite
   "Engineering team") aren't epics (units of work); this produced nonsense
   like "Epic: Engineering team".
3. **False-positive stakeholder extraction.** `extractAffectedUsers`
   naive-keyword-scans the full user-message text. `answerClarification`
   echoes `"<question> — <answer>"` into a new user-role message for agent
   context — when a question's own phrasing mentions a term to ask about it
   (e.g. "...internal staff, external customers, or both?"), the scanner
   matched "customers" even when the answer explicitly ruled it out
   ("Internal staff only").
4. **Structural: Discovery context invisible to reviewers on the normal
   path.** `priorClarifications` (the full discovery Q&A) was only ever
   rendered inside `ClarificationPanel`, gated to `status ===
   "clarification_required"` — a different, later intake-level clarification
   mechanism. Most Discovery-originated intakes land straight in
   `intake_review` and skip that status entirely, so the context the
   requester already provided during Discovery was on the record but never
   shown to a human reviewer.

## Fixes

### Mock agent bugs (`src/application/discovery/agents/`)

- `discovery-agent-contract.ts` — added `stripEchoedQuestion()`, a shared
  helper. Also changed `answerClarification`'s echoed-message format (in
  `discovery-orchestrator.ts`) from `"<question> — <answer>"` to
  `"<question>\nAnswer: <answer>"` — a punctuation-based split (checking the
  question ends in "?") turned out unreliable since some question templates
  have a trailing explanatory sentence after the "?" (period-terminated,
  not question-mark-terminated); an unambiguous literal marker is robust
  regardless of internal punctuation. Applied in `mock-problem-framing-agent.ts`
  and `mock-intent-extraction-agent.ts` (both independently built `rawText`
  from user messages the same way).
- `mock-proposal-composer-agent.ts` — added `truncateAtWord()`, applied to
  both title-building branches. Replaced the dependencies-as-epics mapping
  with a fixed generic breakdown matching the real agent's own guidance
  ("Requirements & Design", "Core Implementation", "Integration & Testing",
  "QA & Launch").

### Visibility gap (`apps/web/`)

- `lib/types.ts` — widened `ProjectIntakeRecord.source` to include
  `rawPayload?: Record<string, unknown>` (already sent by the backend, just
  untyped on the frontend).
- `app/intakes/[id]/page.tsx` — added a "From Discovery" `InfoCard` on the
  Overview tab, shown whenever `priorClarifications` is non-empty,
  independent of intake status. Deliberately did not surface
  `suggestedEpics`/manifest data here — that stays scoped to Discovery's own
  UI, preserving the Work Breakdown Agent boundary above.

## Testing

- `npx tsc --noEmit` (core + apps/web) — clean.
- `npm test` (774 tests) — 772 pass; the 2 failures are pre-existing and
  unrelated (a flaky network-dependent auth test, and an untracked
  in-progress `monday-config` test from a different task).
- Live-verified end-to-end in a mock-provider browser preview:
  - Repro'd the exact original bug (title truncation, fake epics,
    "customers" false-positive) against the unfixed code first.
  - After the fix: fresh session → answered "internal staff only" to the
    affected-people question → confirmed `affectedUsers` correctly excludes
    "customers" (`['internal staff', 'managers', 'operations team']`).
  - Confirmed the isolated `stripEchoedQuestion` fix directly against the
    exact real question text and exact message format the orchestrator
    produces (first fix attempt used a punctuation heuristic and a
    `lastIndexOf` bug that both failed against real question templates —
    caught by testing against the actual repro case, not just re-reading
    the diff).
  - Generated a full proposal/manifest: confirmed title now reads "Custom
    Build — internal tool to track vendor contract renewal dates and…"
    (word-boundary truncated) and epics are the fixed generic list.
  - Confirmed "From Discovery" renders correctly on the Overview tab for an
    `intake_review`-status intake (previously invisible).

## Not Changed

- Did not copy `proposal.suggestedEpics`/manifest data into
  `ProjectIntakeRecord`/`DiscoveryRecord` — ruled out per the Work Breakdown
  Agent boundary in `ai-orchestration.md`.
- Did not attempt to parse `systemsTouched: string[]` out of clarification
  answer prose (e.g. "Google Workspace" + "our contracts spreadsheet" from a
  free-text answer) — reliable extraction without an LLM call is fragile;
  the raw answer is already preserved verbatim in `priorClarifications` and
  now visible via the new "From Discovery" card.

## Follow-up

None new.
