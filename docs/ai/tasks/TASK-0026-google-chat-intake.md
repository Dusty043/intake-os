# TASK-0026 — Google Chat App Intake (Slash Command)

**Status:** SPEC READY — blocked on Google Cloud project and Workspace admin access.
**Spec date:** 2026-06-19
**Handoff:** [HANDOFF-0026-google-chat-intake.md](./HANDOFF-0026-google-chat-intake.md)

---

## Goal

Allow anyone in the Simple.biz Google Workspace to submit a project intake directly
from Google Chat using a `/intake` slash command. The command opens a dialog form;
form submission creates a `draft` intake with `source: { system: "google_chat" }`.

This is the interactive, inbound half of the Google Chat integration.
The outbound half (notifications) is already implemented in TASK-0024.

---

## Blocked On

```
GCP_PROJECT_ID         — a Google Cloud project with Chat API enabled
CHAT_APP_CREDENTIALS   — service account JSON key for the Chat app
GOOGLE_WORKSPACE_ADMIN — someone with Google Workspace Admin to install the app
```

Do not start implementing until these are confirmed.

---

## Architecture

Google Chat apps are stateless webhooks. When a user types `/intake`, Google sends
a POST to our app endpoint. We respond with a dialog form. User fills out the form
and clicks Submit. Google sends another POST with the form data. We create the intake.

```
User types /intake in Google Chat
        ↓
  Google Chat API → POST /intake-sources/chat  (app endpoint, verified by Google JWT)
        ↓
  IntakeSourcesController → returns Dialog response (JSON)
        ↓
  User fills form → clicks Submit
        ↓
  Google Chat API → POST /intake-sources/chat  (actionResponse with form values)
        ↓
  GoogleChatIntakeParser → draft ProjectIntakeRecord
        ↓
  Google Chat API → confirmation card: "Intake submitted. View: [link]"
```

---

## GCP Setup Requirements

### 1. Google Cloud Project

Create a project at console.cloud.google.com (or use an existing one for Simple.biz).

Enable APIs:
- Google Chat API (`chat.googleapis.com`)

### 2. Service Account

Create a service account in the GCP project. Download the JSON key file.
This is how the app authenticates Google's JWT tokens on incoming webhook requests.

The key file must live at a path referenced by `GOOGLE_CHAT_APP_CREDENTIALS_PATH`
on oreochiserver. Never commit it to git.

### 3. Chat App Configuration

In Google Chat API → Configuration:

- **App name**: Intake OS
- **Avatar URL**: (optional, can be the OS logo)
- **Description**: Submit project intake requests
- **Functionality**: Enable "Receive 1:1 messages" and "Join spaces and group conversations"
- **Connection settings**: App URL → `https://100.75.210.83/intake-sources/chat`
- **Slash commands**: Add `/intake` (command ID: 1, description: "Submit a project intake request")
- **Visibility**: Make the app available to your Google Workspace domain

### 4. Workspace Admin Install

A Google Workspace Admin must install the app for the domain (or specific spaces).
Without admin install, individual users can add the app but it won't have slash
command access in spaces.

---

## Slash Command: /intake

### Dialog Form Fields

```
Project Title*         (text input, required)
Description*           (textarea, required)
Project Type           (dropdown: same list as web form)
Requester Name*        (text input, pre-filled with Chat user's display name)
Department             (text input, optional)
Deadline               (date picker, optional)
```

Card-based dialog, not a web redirect.

### Form Submission

Google sends the form values as a `CARD_CLICKED` action with `commonEventObject.formInputs`.

The controller extracts values, passes to `GoogleChatIntakeParser`, creates a `draft` intake.

Response: a text card in the same space:

```
✅ Intake submitted
*Client Portal Redesign*
Status: draft — an intake owner will review shortly.
[View in Intake OS] → https://100.75.210.83/intakes/{id}
```

---

## Endpoint: POST /intake-sources/chat

Handles two request types from Google Chat:

| `type` | What it is | Response |
|---|---|---|
| `MESSAGE` with slash command | User typed `/intake` | Open dialog (JSON) |
| `CARD_CLICKED` with `formSubmit` | User submitted the dialog | Create intake + confirmation card |
| `ADDED_TO_SPACE` | App added to a space | Welcome message |
| `REMOVED_FROM_SPACE` | App removed | Log only, no response needed |

### Authentication

Google Chat sends a Bearer JWT in the `Authorization` header. Verify it:
- JWT issuer = `chat@system.gserviceaccount.com`
- Audience = your GCP project number or app ID
- Verify signature using Google's public keys (fetched from JWKS endpoint)

Use `google-auth-library` npm package for JWT verification:
```typescript
import { OAuth2Client } from "google-auth-library";
```

Reject with `401` if JWT is invalid.

---

## GoogleChatIntakeParser

Normalizes form submission into `CreateIntakeInput`:

```typescript
{
  title: formInputs["project_title"],
  description: formInputs["description"],
  requester: formInputs["requester_name"] || event.user.displayName,
  projectType: formInputs["project_type"] || "unknown",
  department: formInputs["department"] || undefined,
  source: {
    system: "google_chat",
    externalId: `${event.space.name}:${event.eventTime}`,  // idempotency key
    rawPayload: JSON.stringify(event),
  },
}
```

Draft-first: same as email intake. Intakes land in `draft` state.

---

## Token / Credential Requirements

**No OAuth web flow** — the app acts as a server-side bot, not as the user.

What's needed:
- Service account JSON key → verify incoming Google JWTs
- No outbound calls to the Chat API needed for v1 (responses are synchronous HTTP replies)

For v2 (proactive notifications, updating cards): outbound Chat API calls would
require `chat.messages` scope on the service account.

---

## Error Handling

| Condition | Response |
|---|---|
| JWT invalid | `401` |
| Form submitted without required fields | Dialog validation error (re-open dialog with error message) |
| Intake creation fails (DB error, validation) | Chat error card: "Something went wrong, please try again" |
| User not in Google Workspace | JWT verification fails → `401` |

---

## Files Expected

```
src/application/intake-sources/google-chat-intake-parser.ts   — form parsing
apps/api/src/modules/intake/intake-sources.controller.ts      — shared with email (add POST /intake-sources/chat)
apps/api/src/modules/intake/google-chat-jwt.middleware.ts     — JWT verification middleware
tests/google-chat-intake-parser.test.mjs                      — unit tests
```

---

## Acceptance Criteria

1. `POST /intake-sources/chat` endpoint verifies Google JWT before processing.
2. `/intake` slash command triggers a dialog with the 6 form fields listed above.
3. Dialog form submission creates a `draft` intake with `source.system === "google_chat"`.
4. `requester` pre-populates from the Chat user's display name.
5. Confirmation card is sent in response after successful creation.
6. Confirmation card includes a link to the intake in Intake OS.
7. Returns `401` for invalid or missing JWT.
8. Required fields (title, description, requester) validated server-side.
9. Raw form event payload stored in `source.rawPayload`.
10. `ADDED_TO_SPACE` event returns a welcome card.

---

## Relationship to TASK-0024

TASK-0024 (Google Chat Notifications) sends messages TO a Chat space via an
incoming webhook URL. This task creates a Chat App that RECEIVES messages from Chat.
These are two separate mechanisms. TASK-0024 does not depend on this task.

Both use Google Chat, but they are completely independent.

---

## Open Questions

| # | Question | Why it matters |
|---|---|---|
| Q-C-1 | **Does Simple.biz have a Google Workspace admin?** | Required to install the Chat app domain-wide |
| Q-C-2 | **Which Google Cloud project?** | Need project ID to enable Chat API and create service account |
| Q-C-3 | **Which Chat spaces should the app be installed in?** | The app only works in spaces where it's installed |
| Q-C-4 | **Should `/intake` be available in 1:1 messages with the bot, or only in spaces?** | Affects app configuration |
| Q-C-5 | **Should the form include the Project Type dropdown?** | Adds complexity to the dialog; can default to "unknown" and let intake owners set it |
