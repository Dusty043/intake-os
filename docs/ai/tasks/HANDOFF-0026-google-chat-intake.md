# Handoff: TASK-0026 — Google Chat App Intake (Waiting on GCP Access)

**Written:** 2026-06-19
**Status:** BLOCKED — needs Google Cloud project + Workspace admin
**Spec:** [TASK-0026-google-chat-intake.md](./TASK-0026-google-chat-intake.md)

---

## What This Handoff Is For

The architecture for a Google Chat `/intake` slash command is fully designed. When a
developer types `/intake` in a Chat space, a dialog form opens. They fill out the
project details and click Submit — a draft intake lands in the Intake OS.

This is more involved to set up than Monday or GitHub because it requires Google Cloud
infrastructure. This document tells you exactly what to set up and what decisions to make.

---

## Open Questions — Decide Before Any Code

| # | Question | Why it matters |
|---|---|---|
| Q-C-1 | **Does Simple.biz have a Google Workspace admin account?** | Required to install a Chat app domain-wide. Without admin, users can add the bot to 1:1 chats but not to spaces with slash commands. |
| Q-C-2 | **Which Google Cloud project should we use?** | Need a GCP project to enable the Chat API and create a service account. Can be a new project dedicated to Intake OS. |
| Q-C-3 | **Which spaces should the bot live in?** | E.g. `#dev-team`, `#new-projects`. The bot only works in spaces where it's installed. |
| Q-C-4 | **Should `/intake` work in 1:1 messages with the bot?** | Slightly simpler UX for users who don't know which space to use. Can be enabled in the app config. |
| Q-C-5 | **Should the dialog include a Project Type dropdown?** | Adds a nice touch but can be omitted if "unknown" is an acceptable default that intake owners clean up later. |

---

## Step 1: Create a Google Cloud Project

1. Go to console.cloud.google.com
2. Create a new project (or use an existing one): "Simple Biz Intake OS"
3. Note the **Project ID** (e.g. `simplebiz-intake-os`)

---

## Step 2: Enable Google Chat API

In the GCP project:
1. Go to APIs & Services → Library
2. Search for "Google Chat API"
3. Enable it

---

## Step 3: Configure the Chat App

1. Go to APIs & Services → Google Chat API → Configuration
2. Fill in:
   - **App name**: Intake OS
   - **Description**: Submit project intake requests
   - **App URL**: `https://100.75.210.83/intake-sources/chat`
   - **Slash commands**: Add one:
     - Command ID: `1`
     - Command name: `/intake`
     - Description: "Submit a new project intake request"
     - Open dialog: Yes
3. Under Visibility: select your Workspace domain so all users can add it

---

## Step 4: Create a Service Account

1. Go to IAM & Admin → Service Accounts
2. Create a service account (e.g. `intake-os-chat-app@simplebiz-intake-os.iam.gserviceaccount.com`)
3. No additional IAM roles needed (the app just verifies incoming JWTs)
4. Create a JSON key: Service Account → Keys → Add Key → JSON
5. Download the file

This JSON key goes on oreochiserver. It is **never committed to git**.

---

## Step 5: Add the Key to oreochiserver

```bash
ssh oreo@100.75.210.83
# Upload the key file (via scp or paste contents)
nano /home/oreo/intake-os/google-chat-service-account.json
chmod 600 /home/oreo/intake-os/google-chat-service-account.json
```

Then add to `.env.server`:
```
GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json
```

---

## Step 6: Install the App in Workspace (Admin Required)

1. Google Admin Console → Apps → Google Workspace Marketplace apps
2. Or: Ask users to add the app to their spaces manually (if no admin install)
3. The app's identifier in Marketplace search is found at: APIs & Services → Chat API → Publishing

---

## Env Vars for `.env.server`

```
GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json
```

That's it. No token, no client secret. The service account JSON handles JWT verification.

---

## What Gets Built Once This Is Set Up

**`src/application/intake-sources/google-chat-intake-parser.ts`** (~80 lines)
- Normalizes Chat form submission to `CreateIntakeInput`
- Draft-first, same as email

**`apps/api/src/modules/intake/intake-sources.controller.ts`** (shared with email)
- `POST /intake-sources/chat`
- JWT verification middleware
- Dialog response builder for `/intake` slash command
- Confirmation card builder

**`apps/api/src/modules/intake/google-chat-jwt.middleware.ts`** (~40 lines)
- Verifies incoming Google Bearer JWT using `google-auth-library`
- Rejects invalid requests with `401`

Roughly 3–4 hours to implement once GCP is set up and the app URL is configured.

---

## Already Done (No Action Needed)

**TASK-0024 — Outbound Chat notifications** are already implemented and work with just
a webhook URL. You can use that today with any Google Chat space — no GCP project needed.
See: `src/application/notifications/google-chat-notifier.ts`

The inbound intake (this task) is a separate mechanism that requires the full GCP setup above.

---

## Relationship to Other Tasks

| Task | Dependency |
|---|---|
| TASK-0024 (Chat notifications) | Independent — already done |
| TASK-0025 (Email intake) | Independent — no shared infrastructure |
| TASK-0023D (Monday adapter) | Independent — no shared infrastructure |
| TASK-0023E (GitHub adapter) | Independent — no shared infrastructure |
