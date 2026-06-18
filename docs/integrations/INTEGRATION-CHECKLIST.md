# Integration Checklist

Fill this in before each implementation session. Bring it back and the code can be written immediately.

Reference: [INTEGRATION-SETUP-GUIDE.md](./INTEGRATION-SETUP-GUIDE.md) for step-by-step instructions on how to get each value.

---

## Google Chat Notifications

These activate the notifications that are already coded and waiting.

| # | What | Your answer |
|---|---|---|
| 1 | Webhook URL from the target Chat space | `GOOGLE_CHAT_WEBHOOK_URL=` |
| 2 | Public URL of the app (for clickable intake links) | `INTAKE_APP_URL=https://100.75.210.83` |

**Decision:**
- [ ] Which Chat space should receive notifications? _______________

---

## Monday Provisioning

| # | What | Your answer |
|---|---|---|
| 3 | Monday API token (personal or service account) | `MONDAY_API_TOKEN=` |
| 4 | Board ID (from the board URL) | `MONDAY_BOARD_ID=` |
| 5 | Group ID where new items should land | `MONDAY_GROUP_ID=` |
| 6 | Column map JSON (column ID → intake field) | `MONDAY_COLUMN_MAP_JSON=` |

**Decisions:**
- [ ] Which board receives new project intakes? _______________
- [ ] Which group within that board? _______________
- [ ] Which columns map to: project type, requester, story points, intake link? _______________
- [ ] Should subtasks from the distribution package become Monday subitems? Yes / No / Defer to v2
- [ ] Personal token or service account token? _______________

**To get the group ID and column IDs**, run these queries in [Monday's API Playground](https://developer.monday.com/api-reference/playground):

```graphql
# Groups
{ boards(ids: [YOUR_BOARD_ID]) { groups { id title } } }

# Columns
{ boards(ids: [YOUR_BOARD_ID]) { columns { id title type } } }
```

---

## GitHub Provisioning

| # | What | Your answer |
|---|---|---|
| 7 | GitHub Personal Access Token | `GITHUB_PAT=` |
| 8 | GitHub org name | `GITHUB_ORG=` |
| 9 | Repo visibility | `GITHUB_REPO_VISIBILITY=private` ← confirm or change |
| 10 | Default team prefix for repo names | `GITHUB_DEFAULT_TEAM_PREFIX=` |
| 11 | Create issues from subtasks? | `GITHUB_CREATE_ISSUES=false` ← confirm or change |

**Decisions:**
- [ ] Which GitHub org? _______________
- [ ] Classic PAT or fine-grained token? _______________
  - Classic needs: `repo` scope
  - Fine-grained needs: Contents (rw), Issues (rw), Metadata (r), Members (r) org permission
- [ ] Repos private by default? Yes / No
- [ ] Default team prefix (e.g. `ds`, `ops`, `client`)? _______________
- [ ] Create one GitHub issue per subtask on provisioning? Yes / No

---

## Email Intake

| # | What | Your answer |
|---|---|---|
| 12 | Which inbound email service? | `INTAKE_EMAIL_SERVICE=` (postmark/cloudmailin/mailgun/sendgrid) |
| 13 | Webhook signing secret from the service | `INTAKE_WEBHOOK_SECRET=` |
| 14 | Intake email address | `INTAKE_EMAIL_ADDRESS=` |

**Decisions:**
- [ ] Which inbound email service? _______________
- [ ] What address should users send project requests to? _______________
  - Option A: service-provided address (e.g. `xyz@cloudmailin.net`) — no DNS changes needed
  - Option B: custom address like `intake@simple.biz` — needs forwarding rule or MX record
- [ ] Should a confirmation reply be sent to the requester? Yes / No / Defer

**After picking a service:**
1. Create account and set inbound rule to POST to `https://100.75.210.83/intake-sources/email`
2. Copy the signing secret from the dashboard

---

## Google Chat Slash Command Intake

This one requires a Google Workspace admin and a Google Cloud project.

| # | What | Your answer |
|---|---|---|
| 15 | GCP project ID | _______________  |
| 16 | Service account JSON key file | (upload to server at `/home/oreo/intake-os/google-chat-service-account.json`) |

**Decisions:**
- [ ] Does Simple.biz have a Google Workspace admin available? Yes / No / Need to find out
- [ ] Which GCP project? Existing / Create new one: _______________
- [ ] Which Chat spaces should the bot be installed in? _______________
- [ ] Should `/intake` work in 1:1 messages with the bot (in addition to spaces)? Yes / No
- [ ] Should the dialog include a Project Type dropdown? Yes / No (can default to "unknown")

**Setup steps (see guide for full details):**
1. Enable Google Chat API in GCP project
2. Configure app in API console: URL = `https://100.75.210.83/intake-sources/chat`, slash command `/intake`
3. Create service account, download JSON key
4. Put key on server, set `GOOGLE_CHAT_APP_CREDENTIALS_PATH`
5. Ask Workspace admin to install the app

---

## Summary: `.env.server` Template

Copy this, fill in your values, and paste into `.env.server` on the server:

```bash
# ── Google Chat notifications ──────────────────────────────
GOOGLE_CHAT_WEBHOOK_URL=
INTAKE_APP_URL=https://100.75.210.83

# ── Monday ────────────────────────────────────────────────
MONDAY_API_TOKEN=
MONDAY_BOARD_ID=
MONDAY_GROUP_ID=
MONDAY_COLUMN_MAP_JSON=
MONDAY_API_VERSION=2026-04

# ── GitHub ────────────────────────────────────────────────
GITHUB_PAT=
GITHUB_ORG=Simple-biz
GITHUB_REPO_VISIBILITY=private
GITHUB_DEFAULT_TEAM_PREFIX=ds
GITHUB_CREATE_ISSUES=false

# ── Provisioning targets ───────────────────────────────────
# Set to monday, github, or monday,github
PROVISIONING_TARGETS=monday

# ── Email intake ───────────────────────────────────────────
INTAKE_EMAIL_SERVICE=
INTAKE_WEBHOOK_SECRET=
INTAKE_EMAIL_ADDRESS=

# ── Google Chat app intake ────────────────────────────────
GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json
```

---

## What Can Be Done Without All of This

| Integration | Blocked on |
|---|---|
| Chat notifications (Step 1) | Just a webhook URL — done in 2 min |
| Monday (Step 2) | Monday credentials + board setup |
| GitHub (Step 3) | GitHub PAT + org confirmed |
| Email intake (Step 4) | Email service choice + signing secret |
| Chat slash command (Step 5) | GCP project + Workspace admin |

Steps 1–4 are independent of each other. Step 5 can wait if Workspace admin is unavailable.

---

## Fastest Path to Value

1. **Right now (2 min):** Webhook URL → Chat notifications live
2. **This week:** Monday token + board setup → real Monday items on execution
3. **This week:** GitHub PAT → real repos on execution
4. **Next:** Email service → email-to-intake pipeline
5. **When admin available:** GCP setup → `/intake` slash command in Chat
