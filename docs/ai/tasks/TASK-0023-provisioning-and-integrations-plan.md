# TASK-0023 — Provisioning + Integrations Planning Doc

**Status:** PLANNING — not started. Waiting on decisions below.
**Date drafted:** 2026-06-16

---

## What This Covers

Three areas, roughly in order of priority:

1. **Live provisioning** — turn the existing dry-run preview into real Monday items and GitHub repos
2. **Email intake input** — accept intake requests arriving via email
3. **Google Chat integration** — outbound notifications + inbound `/intake` command

The state machine, approval gates, dry-run plan, and UI preview are all already working. What's missing is anything that writes to external systems.

---

## Decisions Needed Before Each Phase

### Phase 1 — Monday Provisioning

| # | Decision | Notes |
|---|---|---|
| 1 | **Monday API token** — where does it live? | Goes in `.env.server` on oreochiserver. Never committed. |
| 2 | **Monday board ID** — which board receives new projects? | One board ID per distribution mode, or one shared board? |
| 3 | **Monday column mapping** — which columns map to: title, project type, story points, requester, status, GitHub repo link, OS link? | Column IDs needed before any code can be written. |
| 4 | **Monday subitems** — should subtasks from the distribution package become subitems on the Monday item? | Optional in v1. |

### Phase 2 — GitHub Provisioning

| # | Decision | Notes |
|---|---|---|
| 5 | **GitHub org** — which org should repos be created under? | `Simple-biz`? Something else? |
| 6 | **GitHub auth** — PAT in `.env.server`, or create a GitHub App? | PAT is simpler to start. App is better long-term for auditability. |
| 7 | **PAT scopes required** — `repo` (create private repos) + `admin:org` if creating under an org | Confirm before generating the token. |
| 8 | **Repos private by default?** | Likely yes for internal projects. |
| 9 | **Team prefixes** — which prefixes are approved? | Spec examples: `ds`, `ops`, `client`, `internal`. Confirm final list. |
| 10 | **Which project types require a GitHub repo?** | Currently controlled by `requiresGitHub` on the project type registry. Confirm defaults. |

### Phase 3 — Email Intake Input

| # | Decision | Notes |
|---|---|---|
| 11 | **Which email address** receives intake requests? | e.g. `intake@simple.biz`, a Gmail alias, a forwarding address |
| 12 | **How does email reach the app?** | Option A: Gmail API push notifications (needs Google Cloud project). Option B: email forwarding to an inbound parse webhook (Cloudmailin, Mailgun inbound, etc. — simpler, no GCP needed). |
| 13 | **What happens with email threads / replies?** | Parser should deduplicate by message-id. Threads probably create one intake, not many. |
| 14 | **Should email-sourced intakes auto-submit, or land in `draft` for human review first?** | Safer to land in `draft` so a human reviews before evaluation kicks off. |

### Phase 4 — Google Chat Integration

| # | Decision | Notes |
|---|---|---|
| 15 | **Which Google Chat space** should notifications go to? | Space name or webhook URL. Probably a `#intake-notifications` space. |
| 16 | **Notification triggers** — which events should post to Chat? | Suggestions: `clarification_required`, `approval_needed` (Gate 1 + Gate 2), `provisioning_failed`, `distributed`. |
| 17 | **Google Cloud project** — does one exist for Simple.biz? | Needed for Chat app + Gmail API. Can be created for free. |
| 18 | **Auth model** — service account (recommended for server-to-server Chat) or OAuth web flow? | Service account is simpler for notifications. OAuth needed for user-attributed actions. |
| 19 | **Inbound Chat intake (`/intake` command)** — is this wanted in v1, or just outbound notifications first? | The outbound webhook is simpler and has no GCP app verification requirement. The `/intake` command requires a published Chat app. |

---

## What Each Phase Builds

### Phase 1 — Live Monday Provisioning
*Prerequisite: decisions 1–4*

- `MondayApiClient` — thin wrapper around Monday REST API
- `MondayProvisioningService` — maps distribution package to Monday item + subitems, enforces idempotency keys, stores external Monday item IDs
- Provisioning step model — per-step status, external ID, idempotency key, retry count, error message
- `start_provisioning` action in workflow service — transitions `approved → provisioning`
- Stores `mondayItemId` and `mondayItemUrl` on intake record
- UI: "Provision Now" button in Distribution tab (gated behind `status === "approved"` and valid plan), link to Monday item on success

### Phase 2 — Live GitHub Provisioning
*Prerequisite: decisions 5–10*

- `GitHubApiClient` using `@octokit/rest`
- `RepoNamingService` — slug generation per spec (team prefix + type segment + project slug, collision check via GitHub API)
- `GitHubProvisioningService` — creates repo, writes README from distribution package, creates labels, creates initial issues from subtasks
- Collision detection before repo creation
- Stores `githubRepoId` and `githubRepoUrl` on intake record
- UI: per-step provisioning progress, GitHub repo link on success

### Phase 2.5 — Retry + Partial Success UI
*Follows Phase 1 + 2*

- Distribution tab: per-step status view (succeeded / failed / skipped)
- "Retry failed steps" button — re-runs only failed steps, skips succeeded ones
- `provisioning_failed → provisioning` transition wired
- Audit entries for every provisioning step
- Dead-letter state when retries exhausted — manual recovery options surfaced in UI

### Phase 3 — Email Intake Parser
*Prerequisite: decisions 11–14, independent of Phase 1+2*

- `POST /intake-sources/email` endpoint — receives inbound email webhook, validates signature
- `EmailIntakeParser` — extracts title, requester, raw body from email; normalizes to `CreateIntakeInput`
- Deduplication by email message-id (idempotency key)
- Raw email payload retained
- Creates `ProjectIntakeRecord` in `draft` state with `source: "email"`
- Admin view: email-sourced intakes with raw email preserved

### Phase 4a — Google Chat Outbound Notifications
*Prerequisite: decisions 15–18*

- `GoogleChatNotifier` service — posts message cards to a configured space webhook URL
- Notification triggers: `clarification_required`, Gate 1/2 approval needed, `provisioning_failed`, `distributed`
- Card includes: intake title, status, requester, action link to OS
- Webhook URL in `.env.server`, not committed

### Phase 4b — Google Chat Inbound Intake
*Prerequisite: Phase 4a + decision 19 + Google Cloud app setup*

- Google Cloud project + Chat API enabled
- `/intake` slash command → dialog card form (title, description, requester, project type)
- Card form submission hits `POST /intake-sources/chat` — creates intake with `source: "google_chat"`
- "View in OS" button links back to intake detail page

---

## Recommended Order

```
Phase 1  Monday live     ←  needs decisions 1–4
Phase 2  GitHub live     ←  needs decisions 5–10
Phase 2.5 Retry UI       ←  after 1 + 2
Phase 3  Email input     ←  needs decisions 11–14  (can run in parallel with 1+2)
Phase 4a Chat notify     ←  needs decisions 15–18  (can start after Phase 1)
Phase 4b Chat intake     ←  after 4a + decision 19
```

---

## Risks

| Risk | Severity | Notes |
|---|---|---|
| Monday column schema varies per board — wrong mapping silently creates malformed items | HIGH | Need board + column mapping confirmed before writing any Monday code |
| GitHub PAT rotates or has wrong scopes | HIGH | Validate scopes at startup; surface auth failures explicitly in UI |
| Duplicate provisioning on retry creates duplicate Monday items or GitHub repos | HIGH | Idempotency keys + pre-check against stored external IDs before any write |
| Email parsing is lossy on threaded replies or HTML-heavy emails | MEDIUM | Store raw email; parser produces best-effort draft, not final intake |
| Google Chat App requires GCP + OAuth verification for external workspaces | MEDIUM | Waived if workspace is internal Simple.biz Google Workspace |
| Sync provisioning blocks the API request for slow external APIs | MEDIUM | Acceptable for demo/v1; background job queue is a Phase 3 upgrade |

---

## Open Questions Log

These feed into `docs/ai/OPEN_QUESTIONS.md` when decisions are made.

- Q-PROV-001: Monday board ID and column mapping
- Q-PROV-002: GitHub org and PAT scope
- Q-PROV-003: GitHub repo visibility default
- Q-PROV-004: Team prefix list
- Q-PROV-005: Which project types require GitHub repos by default
- Q-EMAIL-001: Inbound email address
- Q-EMAIL-002: Email delivery mechanism (Gmail API push vs inbound webhook service)
- Q-EMAIL-003: Email thread deduplication policy
- Q-EMAIL-004: Auto-submit vs land in draft
- Q-CHAT-001: Target Google Chat space
- Q-CHAT-002: Notification trigger list
- Q-CHAT-003: Google Cloud project availability
- Q-CHAT-004: Auth model (service account vs OAuth)
- Q-CHAT-005: Inbound Chat intake in v1 vs v2

---

## Next Step

When you're ready to start a phase, answer the decisions for that phase and say "start Phase N." Each phase will get its own task log (`TASK-0023a`, `TASK-0023b`, etc.) once work begins.
