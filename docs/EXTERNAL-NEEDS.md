# External Needs — Project Intake OS

Pre-production activation brief. Everything the OS needs from outside the codebase,
ordered by effort. The first item takes two minutes and the code is already waiting.

---

## Summary

| # | Integration | Effort | Status |
|---|-------------|--------|--------|
| 1 | [Google Chat Notifications](#1-google-chat-notifications) | 2 min | Blocked on webhook URL |
| 2 | [AI Provider](#2-ai-provider) | 5 min | Blocked on API key + provider choice |
| 3 | [Google Sign-In (OAuth)](#3-google-sign-in-oauth-20) | 15 min | Blocked on GCP credentials |
| 4 | [GitHub Provisioning](#4-github-provisioning) | 15 min | Blocked on PAT + org decisions |
| 5 | [Monday Provisioning](#5-monday-provisioning) | 30–45 min | Blocked on API token + board schema |
| 6 | [Email Intake](#6-email-intake) | 30 min + DNS | Blocked on service choice |
| 7 | [Google Chat Slash Command](#7-google-chat-slash-command) | 90 min + admin | Blocked on GCP project + Workspace admin |
| 8 | [Roster API](#8-roster-api) | unknown | Blocked on contract verification |

---

## 1. Google Chat Notifications

Already built and running. Posting a webhook URL activates it — no code change, no redeploy.

**Credentials needed**

| Env var | Source | Example |
|---------|--------|---------|
| `GOOGLE_CHAT_WEBHOOK_URL` | Chat space → click space name → Apps & integrations → Webhooks → Add webhook | `https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=...` |
| `INTAKE_APP_URL` | Your server's public URL — used to generate clickable links in notification cards | `https://oreochiserver.tail0a3a58.ts.net` |

**Decisions**
- [ ] Which Chat space receives intake notifications? Recommend creating `#intake-alerts` if one doesn't exist.

---

## 2. AI Provider

Currently runs mock evaluations that return placeholder data. A real key switches to live AI analysis, risk scoring, and work breakdowns.

Pick one provider. Set `AI_PROVIDER` to the matching value and fill in the credentials.

**Option A — OpenAI**

| Env var | Source |
|---------|--------|
| `AI_PROVIDER=openai` | — |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `OPENAI_MODEL=gpt-4o` | recommended default |

**Option B — Anthropic**

| Env var | Source |
|---------|--------|
| `AI_PROVIDER=anthropic` | — |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
| `ANTHROPIC_MODEL=claude-sonnet-4-6` | recommended default |

**Option C — AWS Bedrock**

| Env var | Source |
|---------|--------|
| `AI_PROVIDER=bedrock` | — |
| `AWS_REGION` | your deployment region |
| `AWS_BEDROCK_MODEL_ID` | e.g. `anthropic.claude-3-5-sonnet-20241022-v2:0` |

No separate API key — uses the AWS instance profile or `~/.aws/credentials` on the server.

**Additional**

| Env var | Value | Notes |
|---------|-------|-------|
| `ANALYSIS_ENGINE` | `orchestrator` | Enables multi-agent evaluation pipeline. Omit to use legacy single-pass. |

**Decisions**
- [ ] Which provider? OpenAI / Anthropic / Bedrock

---

## 3. Google Sign-In (OAuth 2.0)

The full implementation is live (built in TASK-0027/TASK-0033). The server currently runs
`AUTH_MODE=dev_headers` — no real auth. Providing these two values flips it to Google login.

**Credentials needed**

| Env var | Source | Notes |
|---------|--------|-------|
| `AUTH_GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID | Must add authorized redirect URI before creating |
| `AUTH_GOOGLE_CLIENT_SECRET` | Same credentials screen | Copy immediately — console won't show it again without reset |
| `AUTH_PUBLIC_BASE_URL` | The URL users type in their browser | Must exactly match URI registered in Google Cloud Console |

> **Before creating the credential in Google Cloud Console**, add this as an authorized redirect URI:
> `{AUTH_PUBLIC_BASE_URL}/api/auth/google/callback`

**Additional env vars (set alongside the above)**

| Env var | Example value | Notes |
|---------|---------------|-------|
| `AUTH_MODE` | `google` | Flips away from dev_headers mode |
| `AUTH_COOKIE_SECURE` | `true` | Set once server runs over HTTPS |
| `AUTH_ALLOWED_DOMAINS` | `simple.biz` | Any @simple.biz Google account gets access |
| `AUTH_ADMIN_EMAILS` | `dustin@simple.biz` | Comma-separated |
| `AUTH_INTAKE_OWNER_EMAILS` | — | Comma-separated |
| `AUTH_DEVOPS_LEAD_EMAILS` | — | Comma-separated |
| `AUTH_DEVELOPER_EMAILS` | — | Comma-separated |

**Decisions**
- [ ] Which GCP project? Existing or create new?
- [ ] Domain allowlist (`AUTH_ALLOWED_DOMAINS=simple.biz`) or explicit email allowlist?
- [ ] Full role assignment list — who gets admin, intake_owner, devops_lead, developer?

---

## 4. GitHub Provisioning

Creates repos with generated names, README built from the distribution package, standard labels,
and optional subtask issues. Idempotent — retries won't duplicate repos.

**Credentials needed**

| Env var | Source | Notes |
|---------|--------|-------|
| `GITHUB_PAT` | GitHub → Settings → Developer settings → Personal access tokens | See scope notes below |
| `GITHUB_ORG` | Your GitHub organization name | e.g. `Simple-biz` |
| `GITHUB_REPO_VISIBILITY` | Policy decision | `private` or `public` |
| `GITHUB_DEFAULT_TEAM_PREFIX` | Naming policy decision | Prefix for generated repo slugs: `{prefix}-{type}-{slug}` |

**PAT scope options**

- **Classic PAT**: select `repo` scope. Token owner must be an org member with repo creation rights.
- **Fine-grained PAT (preferred)**: resource owner = Simple-biz; permissions: Contents (rw), Issues (rw), Metadata (r); org permission: Members (r).

**Additional**

| Env var | Default | Notes |
|---------|---------|-------|
| `GITHUB_CREATE_ISSUES` | `false` | Set `true` to create one GitHub issue per subtask on provisioning |

**Decisions**
- [ ] Classic PAT or fine-grained?
- [ ] What is the complete approved list of repo name prefixes? (Current examples: `ds`, `ops`, `client`, `internal`)
- [ ] Create GitHub issues for subtasks? Yes / No / Defer to v2

---

## 5. Monday Provisioning

Creates a Monday item for each approved distribution. Needs board inspection to map column IDs
before the executor can register. Idempotent — retries use a stable `Idempotency-Key`.

**Credentials needed**

| Env var | Source | Notes |
|---------|--------|-------|
| `MONDAY_API_TOKEN` | Monday → click avatar → Developers → API → copy personal token | Consider a dedicated "Intake OS" service account for production |
| `MONDAY_BOARD_ID` | Board URL: `monday.com/boards/1234567890` | The number at the end |
| `MONDAY_GROUP_ID` | API Playground query (see below) | Group (section) where new items land |
| `MONDAY_COLUMN_MAP_JSON` | API Playground + board inspection | Maps column IDs to intake fields |

**Fetching MONDAY_GROUP_ID** — run in the [API Playground](https://developer.monday.com/api-reference/playground):
```graphql
{ boards(ids: [BOARD_ID]) { groups { id title } } }
```

**Fetching column IDs**:
```graphql
{ boards(ids: [BOARD_ID]) { columns { id title type } } }
```

**MONDAY_COLUMN_MAP_JSON example** (minimum useful set):
```json
{"text0":"requester","numbers9":"estimatedStoryPoints","link2":"intakeUrl","status":"projectType"}
```

**Additional**

| Env var | Default | Notes |
|---------|---------|-------|
| `MONDAY_API_VERSION` | `2026-04` | Current stable API version |
| `PROVISIONING_TARGETS` | `monday,github` | Set which provisioners are active |

**Decisions**
- [ ] Which board receives incoming project intakes?
- [ ] Which group (section) within that board?
- [ ] Personal token or dedicated service account?
- [ ] Monday subitems for subtasks? Yes / No / Defer to v2

---

## 6. Email Intake

Someone emails a request → OS creates a draft intake automatically. An intake owner reviews
and promotes it — email intakes do not auto-submit.

Pick one inbound email service. All four are supported.

| Service | Notes |
|---------|-------|
| `postmark` | Best webhook format, free tier. Recommended. |
| `cloudmailin` | Simplest setup. |
| `mailgun` | Full-featured. |
| `sendgrid` | Full-featured. |

**Credentials needed**

| Env var | Source | Notes |
|---------|--------|-------|
| `INTAKE_EMAIL_SERVICE` | Your choice above | e.g. `postmark` |
| `INTAKE_WEBHOOK_SECRET` | Service dashboard → inbound route settings | Verifies webhook posts are genuine |
| `INTAKE_EMAIL_ADDRESS` | Your choice | e.g. `intake@simple.biz` or a service-provided address |

> **After picking a service**, configure its inbound route to POST received emails to:
> `https://{server}/intake-sources/email`

**Decisions**
- [ ] Which service? Postmark / Cloudmailin / Mailgun / SendGrid
- [ ] Custom address (`intake@simple.biz`, needs DNS forwarding) or service-provided address (works immediately)?
- [ ] Send a confirmation reply to the requester after their email creates a draft? Yes / No / Defer

---

## 7. Google Chat Slash Command

Type `/intake` in any Chat space → fill a dialog → creates a draft.
Requires a Google Cloud project and a Workspace admin for domain-wide install.

**Credentials needed**

| Env var | Source |
|---------|--------|
| `GOOGLE_CHAT_APP_CREDENTIALS_PATH` | GCP → IAM → Service Accounts → Keys → JSON key |

Download the service account JSON key and SCP it to the server:
```
scp google-chat-service-account.json oreo@100.75.210.83:/home/oreo/intake-os/google-chat-service-account.json
```
Then set `GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json`.

**GCP setup order**
1. Enable Google Chat API (APIs & Services → Library)
2. Configure Chat app: App URL = `https://{server}/intake-sources/chat`, slash command `/intake`, "Opens dialog" = yes
3. Create service account → download JSON key → SCP to server
4. Ask Workspace admin to install the app domain-wide (or per-space)

**Decisions**
- [ ] Which GCP project? Same as OAuth or separate?
- [ ] Domain-wide install or specific spaces only?
- [ ] Should `/intake` work in 1:1 messages to the bot, not just spaces?
- [ ] Who is the Workspace admin who can authorize the domain-wide install?

---

## 8. Roster API

Proposed endpoint at `ai-team.simple.biz/api/roster` would power developer assignment
recommendations. API contract and auth model are unverified.

No credentials can be specified until the contract is confirmed.

**Questions needed before this can move**
- [ ] Is `ai-team.simple.biz/api/roster` live, a prototype, or planned?
- [ ] Does it require auth? API key, OAuth token, or open?
- [ ] What fields does it expose? Skills and project-type history are required for v1. Monday user IDs and GitHub usernames are needed for later.
- [ ] Who owns the endpoint and can provide a contract + sample response payload?

---

## Policy Decisions (no external accounts needed — just answers)

| Decision | Question | Context |
|----------|----------|---------|
| Clarification override | Who can force-resubmit a request stuck in "clarification required"? | Recommendation: DevOps Lead or Admin only. Affects the state-machine permission guard. |
| Reprovision override | Who can trigger re-provisioning of an already-distributed request? | Must be explicit to prevent duplicates. Needs a named role and mandatory audit note. |
| Team prefix standards | What is the complete approved list of repo name prefixes? | Must be finalized before GitHub provisioning goes live. |
| Lifecycle authority | Who can mark a distributed project completed? | DevOps Lead only, or also Intake Owner? Affects `executeLifecycleTransition()`. |
| Cancellation notifications | Should canceling a distributed project send a Chat notification? | Provisioning failure notifications already go to Chat. |
| Downstream signal automation | Should the OS receive automated progress signals from Monday and GitHub? | Current design is manual-update only. Bidirectional sync is a v2 question. |
| Monday subitems | Should subtasks from a distribution package become Monday subitems? | Requires separate board schema query + more complex column mapping. |
| GitHub issues on provisioning | Should one GitHub issue be created per subtask when a repo provisions? | Controlled by `GITHUB_CREATE_ISSUES`. Default is `false`. |

---

## Complete .env.server Additions

Fill in the blanks, then paste on the server.

```
ssh oreo@100.75.210.83
nano /home/oreo/intake-os/.env.server
```

Do not commit this file to git.

```bash
# ── Google Chat Notifications ─────────────────────────────────────────────────
GOOGLE_CHAT_WEBHOOK_URL=<https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=...>
INTAKE_APP_URL=https://oreochiserver.tail0a3a58.ts.net

# ── AI Provider ───────────────────────────────────────────────────────────────
AI_PROVIDER=openai                          # or anthropic or bedrock
OPENAI_API_KEY=<sk-proj-...>
OPENAI_MODEL=gpt-4o
ANALYSIS_ENGINE=orchestrator

# ── Google OAuth ──────────────────────────────────────────────────────────────
AUTH_MODE=google
AUTH_GOOGLE_CLIENT_ID=<from Google Cloud Console>
AUTH_GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
AUTH_PUBLIC_BASE_URL=https://oreochiserver.tail0a3a58.ts.net
AUTH_COOKIE_SECURE=true
AUTH_ALLOWED_DOMAINS=simple.biz
AUTH_ADMIN_EMAILS=dustin@simple.biz
AUTH_INTAKE_OWNER_EMAILS=<comma-separated>
AUTH_DEVOPS_LEAD_EMAILS=<comma-separated>
AUTH_DEVELOPER_EMAILS=<comma-separated>

# ── GitHub ────────────────────────────────────────────────────────────────────
GITHUB_PAT=<ghp_...>
GITHUB_ORG=Simple-biz
GITHUB_REPO_VISIBILITY=private
GITHUB_DEFAULT_TEAM_PREFIX=ds
GITHUB_CREATE_ISSUES=false

# ── Monday ────────────────────────────────────────────────────────────────────
MONDAY_API_TOKEN=<from monday.com → Developers → API>
MONDAY_BOARD_ID=<from board URL>
MONDAY_GROUP_ID=<from API Playground>
MONDAY_COLUMN_MAP_JSON={"text0":"requester","numbers9":"estimatedStoryPoints","link2":"intakeUrl"}
MONDAY_API_VERSION=2026-04
PROVISIONING_TARGETS=monday,github

# ── Email Intake ──────────────────────────────────────────────────────────────
INTAKE_EMAIL_SERVICE=postmark
INTAKE_WEBHOOK_SECRET=<from service dashboard>
INTAKE_EMAIL_ADDRESS=intake@simple.biz

# ── Google Chat Slash Command ──────────────────────────────────────────────────
GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json
```

After editing `.env.server`:
```bash
docker compose -f docker-compose.server.yml up -d api web
```
