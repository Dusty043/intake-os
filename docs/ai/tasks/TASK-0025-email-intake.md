# TASK-0025 — Email Intake Pipeline

**Status:** SPEC READY — blocked on email service choice and inbound address.
**Spec date:** 2026-06-19
**Handoff:** [HANDOFF-0025-email-intake.md](./HANDOFF-0025-email-intake.md)

---

## Goal

Accept project intake requests submitted by email. An email sent to a configured
intake address gets parsed and lands as a `draft` `ProjectIntakeRecord` with
`source: { system: "email" }`. A human reviews it before evaluation kicks off.

Email is a source adapter only — it does not change the intake lifecycle, approval
gates, or provisioning behavior.

---

## Architecture Decision: Inbound Webhook Service

Email delivery to the app uses an **inbound webhook parsing service**, not direct
IMAP or Gmail API access.

### Why

- No GCP project required
- No OAuth or token rotation
- No polling loop — push delivery
- Payload is already parsed (headers, from, subject, text, html, attachments)
- Works with any email provider (Gmail, Outlook, custom domain)

### How it works

```
intake@simple.biz (or forwarding address)
        ↓
  Postmark / Cloudmailin / Mailgun / SendGrid Inbound
  (service receives email, parses headers/body, verifies signature)
        ↓
  POST /intake-sources/email  (webhook endpoint on our server)
        ↓
  EmailIntakeParser → draft ProjectIntakeRecord
```

### Recommended services (all equivalent for this use case)

| Service | Inbound feature | Notes |
|---|---|---|
| **Postmark** | Inbound Processing | Best webhook format, HTTPS-only, free tier available |
| **Cloudmailin** | Inbound | Simple, low-cost, generous free tier |
| **Mailgun Routes** | Inbound Routing | Good if already using Mailgun for outbound |
| **SendGrid Inbound Parse** | Inbound Parse Webhook | Works but has unusual multipart format |

Any of the four will work. Pick whichever the team has an account with or prefers.

---

## Blocked On

```
INTAKE_EMAIL_ADDRESS     — the address users will send to (e.g. intake@simple.biz)
INTAKE_EMAIL_SERVICE     — which inbound webhook service to use (postmark/cloudmailin/mailgun/sendgrid)
INTAKE_WEBHOOK_SECRET    — shared secret or signing key from the inbound service (validate payloads)
```

The endpoint design below is the same regardless of service. Only the payload shape
and signature verification vary per provider.

---

## Endpoint: POST /intake-sources/email

### Request

Sent by the inbound email parsing service after they receive an email to the intake address.

Common fields across all four services (normalized in `EmailIntakeParser`):

| Field | Where it comes from |
|---|---|
| `messageId` | `Message-ID` header — idempotency key |
| `from` | Sender address + display name |
| `subject` | Email subject line → intake title |
| `textBody` | Plain text body → intake description |
| `htmlBody` | HTML body (ignored in v1, retained for raw storage) |
| `receivedAt` | Timestamp from service |

### Authentication

Each service provides a way to verify the webhook is genuine:

- **Postmark**: `X-Postmark-Signature` header + HMAC-SHA256 of body
- **Cloudmailin**: Basic auth or signature header
- **Mailgun**: `X-Mailgun-Signature-V2` header
- **SendGrid**: webhook signing secret + ECDSA signature

Validate at the controller layer before parsing. Reject with `401` if invalid.

### Response

- `202 Accepted` — draft intake created. Body: `{ intakeId, status: "draft" }`.
- `409 Conflict` — `messageId` already processed (idempotency).
- `401 Unauthorized` — signature invalid.
- `422 Unprocessable` — could not extract a usable title or description.

---

## EmailIntakeParser

Normalizes the inbound webhook payload into `CreateIntakeInput`.

```
from: "Dustin Oreo <dustin@simple.biz>"
subject: "New project: Client Portal Redesign"
textBody: "We need a new client-facing portal...
           Deadline: end of Q3..."
```

→

```typescript
{
  title: "Client Portal Redesign",             // subject stripped of "Re:", "Fwd:", etc.
  description: textBody.trim(),
  requester: "Dustin Oreo",                    // display name from from address
  source: {
    system: "email",
    externalId: messageId,                     // idempotency key
    rawPayload: JSON.stringify(rawWebhook),    // full original payload retained
  },
  projectType: "unknown",                      // parser cannot infer type from email
  department: undefined,                       // not inferrable in v1
}
```

### Rules

- `title` = subject line, strip `Re:`, `Fwd:`, `[EXT]`, leading/trailing whitespace
- If subject is empty, use first non-empty line of text body (max 100 chars)
- If neither exists, reject with `422`
- `requester` = display name from `From` header; fall back to email address if no display name
- `description` = plain text body, trimmed. If empty, reject with `422`
- Do NOT try to infer `projectType` from email content in v1

### Email thread deduplication

Replies and forwards of the same email thread must not create duplicate intakes.

Deduplication by `Message-ID` header:
- Each email has a unique `Message-ID` (e.g. `<abc123@mail.gmail.com>`)
- Store `externalId` = `Message-ID` on the intake source
- On receive: check if an intake with this `externalId` already exists
- If found: return `409 Conflict`, do not create another intake

Thread replies (In-Reply-To header present) behavior:
- v1: ignore thread context — each reply creates a new intake from scratch
- v2 (future): check `In-Reply-To` / `References` chain; attach replies to original intake

---

## Draft-First Policy

Intakes from email always land in `draft` status. They are NOT automatically submitted.

Rationale:
- Email bodies can be noisy, off-topic, or include sensitive content
- A human must review the parsed intake before the AI evaluation queue picks it up
- The requester can be notified by the system: "Your request has been received and is
  pending review" (future: reply-to confirmation email)

The intake appears in the intake list with `source.system === "email"` and status `draft`.
An intake owner promotes it manually with the existing "Submit" action.

---

## Raw Email Retention

The full inbound webhook payload must be stored in `source.rawPayload` on the intake record.

This satisfies:
- Debugging malformed parses
- Re-processing if parser logic improves
- Audit trail for email-sourced requests

`rawPayload` is not displayed in the UI by default — it is visible to admins in the
intake detail view.

---

## Files Expected

```
src/application/intake-sources/email-intake-parser.ts  — parsing + normalization
apps/api/src/modules/intake/intake-sources.controller.ts  — POST /intake-sources/email endpoint
apps/api/src/modules/intake/dto/email-intake-webhook.dto.ts  — request shape per service
tests/email-intake-parser.test.mjs  — unit tests for parser
```

The `IntakeSourcesController` can also receive future webhook sources (chat, webhook
from external tools) under the same module.

---

## Acceptance Criteria

1. `POST /intake-sources/email` endpoint exists and is protected by webhook signature validation.
2. Validates `messageId` idempotency — returns `409` for duplicate `Message-ID`.
3. Creates a `draft` intake with `source.system === "email"` and `source.externalId === messageId`.
4. Raw webhook payload is stored in `source.rawPayload`.
5. `title` is derived from the subject line (stripped of Re:/Fwd: prefixes).
6. `requester` is the sender display name (falls back to email address).
7. `description` is the plain text body, trimmed.
8. Returns `422` if subject and body are both empty.
9. Returns `401` if webhook signature is invalid.
10. Signature validation logic is provider-configurable via `INTAKE_EMAIL_SERVICE` env var.
11. Unit tests cover: normal email, reply subject stripping, empty subject fallback,
    duplicate messageId rejection, missing body rejection.

---

## Configuration Vars (for `.env.server`)

```
INTAKE_EMAIL_SERVICE=postmark          # postmark | cloudmailin | mailgun | sendgrid
INTAKE_WEBHOOK_SECRET=...              # signing secret from the inbound service
INTAKE_EMAIL_ADDRESS=intake@simple.biz # informational only (for docs/config reference)
```

---

## Open Questions

| # | Question | Why it matters |
|---|---|---|
| Q-E-1 | Which inbound service will you use? | Determines which SDK or signature-check logic to implement |
| Q-E-2 | What email address should users send to? | Configures the inbound rule on the service |
| Q-E-3 | Should a confirmation reply be sent to the requester? | If yes, outbound email (SMTP/Postmark Send) is needed too |
| Q-E-4 | Should email-sourced intakes auto-appear for intake owners to review, or should they go to a separate admin queue? | UI filtering decision |
