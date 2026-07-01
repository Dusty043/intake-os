# TASK-0035 — UX Friction Backlog

**Status:** ACTIVE — items being addressed incrementally  
**Source:** Claude Code session 2026-06-29, friction audit of current UI

---

## Friction Points

### FP-001 — Tab Blindness on Intake Detail  
**Priority:** HIGH  
**Status:** DONE (2026-06-29)

Seven tabs (Overview, AI Draft, Evaluation, Reviewed Package, Approvals, Distribution, Audit Trail) with no visual indication of which contain content or require attention. The workflow is linear but the navigation is flat. A user who just submitted an intake has to know to check "AI Draft" when evaluation completes — nothing tells them where to go.

**Fix direction:** Badge indicators on tabs when content is ready or action is required. Possibly a "next step" indicator embedded in the tab strip.

---

### FP-002 — Required Actions Card Competes Instead of Leads  
**Priority:** HIGH  
**Status:** IN PROGRESS (2026-06-29)

The Required Actions card sits at equal visual weight to Summary and Latest Activity in a 3-column grid. It is the most important element on the page when action is needed, but nothing about the layout communicates that.

**Fix direction:** Move Required Actions to a full-width action zone above the summary grid. Give it state-appropriate tinting and a larger primary action button. Collapse to absent when no action is pending.

**Related task:** TASK-0036 (implementation)

---

### FP-003 — Discovery Sessions Are Unidentifiable in the List  
**Priority:** MEDIUM  
**Status:** DONE (2026-06-29)

The discovery session list shows a 14-character ID slice and a status. No project name, no requester, no first message preview. Two sessions at the same status look identical. Finding "that intake we talked about Monday" requires clicking each one.

**Fix direction:** Show the first user message (truncated) or the `problemStatement` from the completed discovery record as the session summary. Add requester name and last-activity relative timestamp.

---

### FP-004 — Discovery → Intake Handoff Is Invisible  
**Priority:** MEDIUM  
**Status:** DONE (2026-06-29)

When a session reaches `sent_to_evaluation`, the user has no visible path to the intake it spawned. The intake appears on the intakes list but there is no link from the discovery session to the created intake, and no confirmation moment on the discovery page.

**Fix direction:** When `status === "sent_to_evaluation"`, show a linked call-out card: "Intake created — [title] is now in evaluation. View intake →". Store the created intake ID on the session record.

---

### FP-005 — Revise Draft Requires Writing JSON  
**Priority:** HIGH  
**Status:** IN PROGRESS (2026-06-29)

The only way to edit AI-estimated complexity, story points, tech stack, subtasks, and brief is a raw JSON textarea. This is a developer escape hatch shipped as the primary review workflow. Intake owners will not use this.

**Fix direction:** Replace the JSON textarea with a structured form: selects for projectType/complexity, number for storyPoints, textareas for brief fields (problem/solution), newline-separated textareas for scope/techStack/infraNeeds, and a repeating row editor for subtasks.

**Related task:** TASK-0037 (implementation)

---

### FP-006 — No Search or Filter on Intakes List  
**Priority:** MEDIUM  
**Status:** DONE (2026-06-29)

The intakes list is a flat table. Currently 10–20 rows; by the time email intake is live, it will grow fast. No search, no status filter, no date range, no requester filter.

**Fix direction:** Add a filter bar above the table: status multi-select, free-text search on title/requester, date range picker. Server-side filtering via query params. No pagination required at the current scale — client-side filtering on the existing payload is sufficient.

---

### FP-007 — Success Moments Don't Exist  
**Priority:** LOW  
**Status:** DONE (2026-06-29)

Governance actions (Submit Intake, Approve Gate 1, Approve Gate 2, Execute Distribution) all feel identical — the button is clicked, the page reloads, you're back where you were. In a tool where these decisions matter, there should be a moment of confirmation.

**Fix direction:** After each governance action, show a brief toast or inline confirmation ("Gate 1 approved. Intake is now in DevOps review.") before returning to steady state. The existing `ErrorBanner` component can be extended to also show success states.

---

## Implementation Order

| # | Friction Point | Effort | Status |
|---|---|---|---|
| 1 | FP-002 Required Actions prominence | S | IN PROGRESS |
| 2 | FP-005 Revise Draft form | M | IN PROGRESS |
| 3 | FP-007 Success toasts | S | DONE |
| 4 | FP-001 Tab badges | M | DONE |
| 5 | FP-003 Discovery session identifiers | S | DONE |
| 6 | FP-004 Discovery → Intake handoff | M | DONE |
| 7 | FP-006 Search and filter on intakes list | M | DONE |
