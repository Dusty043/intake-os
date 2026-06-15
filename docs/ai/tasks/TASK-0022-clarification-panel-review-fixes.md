# TASK-0022 — ClarificationPanel Review Fixes + Test Infrastructure

**Date:** 2026-06-16
**Branch:** main
**Commits:** `5b9a6f1`, `d0cf9f7`

---

## What This Task Covers

Following a full `/review` pass on the TASK-0021 diff (ClarificationPanel polish), this task applied
all actionable findings in two rounds:

**Round 1 (auto-fixes applied inline to `page.tsx`):**
- `submittingRef` double-submit guard
- `aria-required` / `aria-invalid` / `aria-describedby` on required textareas
- Stable `key` for `priorClarifications` (use `pc.question` instead of index)
- `useEffect` to reset form state when `questions` prop changes

**Round 2 (this task — deeper structural fixes):**
1. DRY extract `ClarificationPanel` + `QuestionField` to a standalone component file
2. Add Vitest + `@testing-library/react` component test infrastructure
3. Fix `approve_gate1` / `approve_gate2` gate discriminator
4. `useCallback` on the `onResubmit` prop in `OverviewTab`

---

## Changes

### `apps/web/src/components/ClarificationPanel.tsx` (new)
- Extracted from `apps/web/src/app/intakes/[id]/page.tsx`
- `QuestionField` sub-component defined *outside* `ClarificationPanel` (no remount on parent re-render) — handles both required and optional questions, including all aria attributes
- Carries all Round 1 fixes: `submittingRef`, `useEffect` reset, `aria-*`, stable keys

### `apps/web/src/components/__tests__/ClarificationPanel.test.tsx` (new)
10 tests covering:
1. Renders required + optional questions
2. Submit disabled when required field empty
3. `aria-required` present on required textarea
4. Inline error + `aria-invalid` after blur on empty required field
5. Enables submit and calls `onResubmit` with correct args
6. Shows success banner after resolve
7. Shows error banner when `onResubmit` rejects
8. Double-submit blocked by `submittingRef`
9. Form resets when `questions` prop changes
10. Prior clarifications rendered

### `apps/web/vitest.config.ts` + `apps/web/vitest.setup.ts` (new)
- Vitest with `jsdom` environment
- `@testing-library/jest-dom` matchers loaded globally
- `@` alias wired to `./src`

### `apps/web/package.json`
- Added dev deps: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`
- Added scripts: `test` (`vitest run`), `test:watch` (`vitest`)

### `apps/web/src/lib/api-client.ts`
- `approveGate()` gains required `gate: "gate_1" | "gate_2"` param
- Passed in the request body so the server can validate the client's intent matches the open gate (server would reject if mismatched — e.g. requesting `gate_2` when `gate_1` is still open)

### `apps/web/src/app/intakes/[id]/page.tsx`
- Removed inline `ClarificationPanel` definition (now imported from `@/components/ClarificationPanel`)
- `PendingClarificationQuestion` import removed (no longer needed here)
- `handleResubmitPanel` callback defined with `useCallback([onAction])` in `OverviewTab`
- `handleAction` passes `"gate_1"` / `"gate_2"` explicitly to `approveGate()`

---

## Test Results

```
vitest run
 Test Files  1 passed (1)
       Tests  10 passed (10)
    Duration  1.40s
```

Typecheck: clean (both monorepo root and `apps/web`).

---

## What Was Intentionally Not Changed

- **Component tests for other components** — no test infra existed before this task. `ClarificationPanel` is now the first covered component. Other components can be added incrementally.
- **`approve_gate1` / `approve_gate2` server-side gate routing** — the server already validates the explicit gate against current state. No server changes were needed.
- **`ActionBtn` extraction** — still lives in `page.tsx`. Not blocking anything. Can be extracted if page.tsx grows further.
- **Gate 1 / Gate 2 `rejectGate` calls** — those also call the same `rejectGate()` function. The rejection API uses status-based inference, not an explicit gate param, and the DTO doesn't have a `gate` field for rejection. Left as-is.

---

## Open Questions

- Should `ActionBtn` be extracted to `src/components/` for reuse and testability?
- Should the rejection path (`rejectGate`) also accept an explicit gate for consistency?

---

## Follow-Up Work

- Add tests for other components (e.g. `EvaluationPanel`, `WorkflowStepper`) as they stabilize
- Consider extracting `ActionBtn` to its own component file
- Add `npm test` to CI/CD pipeline when one is set up
