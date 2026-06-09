# AGENTS.md / CLAUDE.md Workflow Instruction Snippet

Add this to required reading:

- `docs/product/workflow-state-machine.md`

Add this rule near implementation or safety rules:

Read `docs/product/workflow-state-machine.md` before modifying:

- request status enums
- approval logic
- provisioning guards
- state transition functions
- lifecycle-related UI
- audit logging

Do not change lifecycle states, transition rules, approval gates, provisioning guards, or workflow invariants without updating the product spec, tests, and task/ADR notes.
