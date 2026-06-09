# Input Trigger Strategy

## Principle

All project inquiries normalize into the same internal `IntakeSource` and `ProjectIntake` contract before analysis or approval begins.

Input channels are adapters. The Project Intake OS owns orchestration, state, retries, auditability, prompts, schema validation, approvals, and downstream distribution behavior.

## Explicit Architecture Decision

n8n is intentionally excluded from the target architecture for Project Intake OS orchestration.

Reason:

- it would introduce a second workflow runtime;
- it would split retry/error behavior outside the OS;
- it would make auditability and lifecycle state harder to reason about;
- it would create integration behavior the project owner does not fully control.

The OS may still create or manage projects whose type is `n8n_automation`; it should not use n8n as its own orchestration layer.

## Recommended Trigger Order

| Priority | Trigger | Role |
| --- | --- | --- |
| 1 | Manual paste / native web form | Best first-class MVP input. |
| 2 | Native authenticated webhook endpoint | Controlled external ingestion after the normalized contract stabilizes. |
| 3 | Email parser owned by the OS | Useful after missing-information and retention rules are stable. |
| 4 | Google Chat app | Best future chat-native intake UX. |
| 5 | Google Chat incoming webhook | Outbound notifications only, not intake capture. |

## Why Manual/Web First

A native form lets the OS establish the canonical intake fields, validation rules, and review flow without being blocked by Chat or email integration details.

Minimum MVP fields:

- title
- raw inquiry text
- requester
- source
- department/client if known
- deadline if known
- compliance sensitivity flag
- attachments/links later

## Native Webhook Role

A native endpoint such as `POST /intake-sources/webhook` can be added after the web/manual flow is stable.

Webhook requirements:

- authentication or signed payload verification;
- source idempotency key;
- raw payload retention policy;
- normalized intake preview before creating an intake;
- audit event for accepted/rejected payloads.

## Google Chat Role

Use Google Chat incoming webhooks for notifications:

- intake analyzed
- clarification required
- approval needed
- distribution preview ready
- provisioning failed

Use a Google Chat app later for interactive flows:

- `/intake` command
- card/dialog form submission
- review link buttons
- clarification responses

## Email Role

Email parsing should be introduced only after the AI analysis schema and missing-information logic are stable. Email threads can be noisy and may contain sensitive or irrelevant context.
