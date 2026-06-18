# TASK-0024 — Google Chat Notifications (Outbound)

**Status:** COMPLETE
**Completed:** 2026-06-19

---

## Goal

Fire outbound Google Chat card notifications when intake lifecycle events occur.
Notifications are a no-op when `GOOGLE_CHAT_WEBHOOK_URL` is not set, so the feature
ships without requiring credentials before going live.

---

## What Was Built

### `src/application/notifications/google-chat-notifier.ts`

`GoogleChatNotifier` class:
- Constructor takes `webhookUrl?: string` and `intakeBaseUrl?: string`
- `isEnabled: boolean` getter — `true` when webhook URL is configured
- `async notify(payload)` — POSTs a JSON card message to the webhook URL; logs a warning on failure but does NOT throw (fire-and-forget)
- Message format: plain `text` field with emoji, event label, intake title, requester, optional detail, and a link (or intake ID if no base URL)

Event types: `clarification_required`, `intake_review`, `devops_review`, `provisioning_failed`, `distributed`

### `src/application/notifications/google-chat-config.ts`

Loads `GOOGLE_CHAT_WEBHOOK_URL` and `INTAKE_APP_URL` from environment.

### Hook points in `intake-workflow-service.ts`

| Event fired | Where |
|---|---|
| `clarification_required` | `generateEvaluation()` — clarification path, after state transition |
| `intake_review` | `generateEvaluation()` — evaluation ready path, after state transition |
| `intake_review` | `generateMockAnalysisDraft()` — non-orchestrator path, after state transition |
| `devops_review` | `recordApproval()` — when resulting status is `devops_review` (Gate 1 approved) |
| `distributed` | `notifyProvisioningOutcome()` — called by both `executeDistribution` and `retryFailedProvisioningTargets` |
| `provisioning_failed` | `notifyProvisioningOutcome()` — same helper |

Private helper `notifyProvisioningOutcome()` shared by both provisioning paths to avoid duplication.

### Runtime module

`GoogleChatNotifier` created in `RuntimeModule` from `loadGoogleChatConfig()`, passed as `notifier` option to `IntakeWorkflowService`. Logs whether notifications are enabled or disabled at startup.

---

## Configuration

Add to `/home/oreo/intake-os/.env.server` when ready:

```
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...
INTAKE_APP_URL=https://100.75.210.83
```

To get the webhook URL:
1. Open a Google Chat space
2. Apps & integrations → Webhooks → Add webhook
3. Name it "Intake OS", copy the URL

No GCP project, no OAuth, no service account needed.

---

## Tests

`tests/google-chat-notifier.test.mjs` — 9 tests:
- `isEnabled` returns false when no URL
- `isEnabled` returns true when URL present
- No-op when no URL
- Correct JSON POST to webhook
- Link included when `intakeBaseUrl` set
- Intake ID included when no `intakeBaseUrl`
- `detail` field included in message
- No throw on network failure
- No throw on non-200 response
- All 5 event types produce correct labels

---

## Tests Run

```bash
npm run typecheck   # clean
npm run build       # clean
npm test            # 428/428 pass
```

---

## What Was NOT Built (intentionally)

- No tests for notification calls inside `IntakeWorkflowService` — the notifier is an optional
  dep and existing service tests don't pass one in. The notifier itself is unit-tested directly.
- No retry on webhook failure — fire-and-forget is intentional; notifications are best-effort.
- No batching — each lifecycle event fires immediately.

---

## Follow-Up

- TASK-0025: Email intake via inbound webhook (see spec)
- TASK-0026: Google Chat slash command / app intake (see spec + handoff)
