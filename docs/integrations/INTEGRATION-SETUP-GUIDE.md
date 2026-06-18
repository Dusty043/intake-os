# Integration Setup Guide

This guide walks you through activating every external integration in the Intake OS,
in order from fastest to most involved. Do them in order — the first two take under
5 minutes combined and give you immediate value today.

The server lives at `100.75.210.83`. All credentials go into one file:

```bash
ssh oreo@100.75.210.83
nano /home/oreo/intake-os/.env.server
```

Never commit `.env.server` to git.

---

## Step 1 — Google Chat Notifications (2 minutes)

**What it does:** Posts a card to a Chat space whenever an intake needs attention —
clarification required, Gate 1 or Gate 2 review needed, provisioning failed or succeeded.
The code is already live. You just need to give it a URL.

**What to do:**

1. Open any Google Chat space where you want to receive notifications.
   (Create one called `#intake-notifications` if you don't have one.)
2. Click the space name at the top → **Apps & integrations** → **Webhooks** → **Add webhook**.
3. Name it "Intake OS", click Save, and copy the URL.
4. Open `.env.server` on the server and add:

```
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=...&token=...
INTAKE_APP_URL=https://100.75.210.83
```

5. Restart the API (`pm2 restart api` or however you deploy).

That's it. Notifications are live. The system logs "Google Chat notifications: enabled"
on startup to confirm.

---

## Step 2 — Monday Provisioning (30–45 minutes)

**What it does:** When an approved intake is executed, the system creates a new item
on your Monday board with the project title, type, story points, requester, and a
link back to the intake. If provisioning fails it can retry without creating duplicates.

### 2-A: Get the API token

1. Log into Monday.
2. Click your profile picture (bottom left) → **Developers** → **API**.
3. Copy the personal API token shown there.
   - For a service account token (preferred for production), have your Monday admin
     create a dedicated Monday user for "Intake OS" and generate the token under that account.

```
MONDAY_API_TOKEN=eyJhbGciOi...
```

### 2-B: Get the board ID

1. Open the Monday board where new project intakes should land.
2. Look at the URL: `https://simple-biz.monday.com/boards/1234567890`
3. Copy the number — that's the board ID.

```
MONDAY_BOARD_ID=1234567890
```

### 2-C: Get the group ID

Groups are the sections within a board (like "New Requests", "Backlog", "In Progress").
New intakes need to land in a specific group.

1. Go to [Monday's API Playground](https://developer.monday.com/api-reference/playground).
2. Run this query (replace the board ID):

```graphql
{
  boards(ids: [1234567890]) {
    groups {
      id
      title
    }
  }
}
```

3. Find the group where new intake items should appear and copy its `id` value.
   (It looks like `new_group` or `topics` — a short slug, not a number.)

```
MONDAY_GROUP_ID=new_group
```

### 2-D: Build the column mapping

This tells the system which Monday columns to fill in when creating an item.
The item name (project title) is set automatically. Everything else needs a column ID.

1. Run this query in the API Playground:

```graphql
{
  boards(ids: [1234567890]) {
    columns {
      id
      title
      type
    }
  }
}
```

2. You'll see a list like:

```json
{ "id": "status", "title": "Status", "type": "color" }
{ "id": "text0", "title": "Requester", "type": "text" }
{ "id": "numbers9", "title": "Story Points", "type": "numeric" }
{ "id": "link2", "title": "Intake Link", "type": "link" }
```

3. Decide which column maps to which intake field. Minimum useful set:

| Intake field | Monday column type |
|---|---|
| Project type | `status` or `text` |
| Requester name | `text` |
| Estimated story points | `numbers` |
| Intake OS link | `link` |
| Department | `text` (optional) |

4. Build a JSON object:

```json
{
  "text0": "requester",
  "numbers9": "estimatedStoryPoints",
  "link2": "intakeUrl",
  "status": "projectType"
}
```

5. Minify it and set:

```
MONDAY_COLUMN_MAP_JSON={"text0":"requester","numbers9":"estimatedStoryPoints","link2":"intakeUrl","status":"projectType"}
```

### 2-E: Set the targets and validate

```
MONDAY_API_VERSION=2026-04
PROVISIONING_TARGETS=monday
```

Then SSH in and run the smoke test:

```bash
cd /home/oreo/intake-os
PROVISIONING_VALIDATE_MONDAY=true npm run dev:api
```

If everything is correct you'll see "Monday config validated" in the output.
Fix any errors before going live.

---

## Step 3 — GitHub Provisioning (10–15 minutes)

**What it does:** When an approved intake requires a GitHub repo, the system creates
one under your org with an auto-generated name, a README built from the intake package,
standard labels, and optionally one issue per subtask.

### 3-A: Generate a Personal Access Token

**Option A — Classic PAT (quicker):**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scope: `repo` (full control of private repositories)
4. The token owner must be a member of the GitHub org with permission to create repos.
5. Copy the token.

**Option B — Fine-grained PAT (recommended for production):**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Resource owner: `Simple-biz`
3. Repository access: All repositories
4. Repository permissions: `Contents: Read and write`, `Issues: Read and write`, `Metadata: Read`
5. Organization permissions: `Members: Read`
6. Copy the token.

```
GITHUB_PAT=ghp_...
```

### 3-B: Set the org and defaults

```
GITHUB_ORG=Simple-biz
GITHUB_REPO_VISIBILITY=private
GITHUB_DEFAULT_TEAM_PREFIX=ds
GITHUB_CREATE_ISSUES=false
```

Change `GITHUB_DEFAULT_TEAM_PREFIX` if your repos use a different prefix (e.g. `ops`, `client`).
Set `GITHUB_CREATE_ISSUES=true` if you want one GitHub issue created per subtask.

### 3-C: Update the targets and validate

If running both Monday and GitHub:
```
PROVISIONING_TARGETS=monday,github
```

If GitHub only for now:
```
PROVISIONING_TARGETS=github
```

Smoke test:
```bash
PROVISIONING_VALIDATE_GITHUB=true npm run dev:api
```

This will create and immediately delete a test repo (`__intake-os-smoke-test__`) to
confirm write access. Fix any errors before going live.

---

## Step 4 — Email Intake (30 minutes + DNS if custom domain)

**What it does:** Someone sends an email to a configured intake address. The system
receives the email, parses it, and creates a `draft` intake automatically. An intake
owner reviews and promotes it manually — email intakes do not auto-submit.

### 4-A: Choose an inbound email service

Pick whichever you have an account with or prefer. They all work:

| Service | Sign up | Notes |
|---|---|---|
| **Postmark** | postmarkapp.com | Best webhook format, free tier |
| **Cloudmailin** | cloudmailin.com | Simplest, cheapest |
| **Mailgun** | mailgun.com | Good if already using Mailgun |
| **SendGrid** | sendgrid.com | Works, slightly more complex format |

### 4-B: Set up the inbound rule

Each service gives you a forwarding address (e.g. `abc123@cloudmailin.net`) or lets
you configure a custom domain with an MX record.

Configure the inbound rule to POST received emails to:
```
https://100.75.210.83/intake-sources/email
```

### 4-C: Get the signing secret

Every service provides a way to verify that a webhook is genuine. After creating the
inbound rule, find the signing key or shared secret in the service dashboard and copy it.

### 4-D: Decide on the intake email address

You can use:
- The service-provided address directly (e.g. `xyz@inbound.postmarkapp.com`) — no DNS changes needed
- A custom address like `intake@simple.biz` — requires a forwarding rule or MX record pointing to the service

### 4-E: Add to `.env.server`

```
INTAKE_EMAIL_SERVICE=postmark
INTAKE_WEBHOOK_SECRET=...
INTAKE_EMAIL_ADDRESS=intake@simple.biz
```

After deploying, send a test email to the intake address and confirm a `draft` intake
appears in the app.

---

## Step 5 — Google Chat Slash Command Intake (1–2 hours, requires Workspace admin)

**What it does:** Anyone in your Google Workspace can type `/intake` in a Chat space
to open a form. They fill in the project title, description, and type. Submitting
creates a `draft` intake and sends a confirmation card with a link to view it.

**Note:** This requires a Google Workspace admin to install the app domain-wide, and
a Google Cloud project to host the app configuration. If you don't have admin access,
coordinate with whoever manages your Google Workspace before starting this step.

### 5-A: Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (e.g. "Simple Biz Intake OS") or use an existing one.
3. Note the **Project ID**.

### 5-B: Enable the Google Chat API

1. In your GCP project, go to **APIs & Services → Library**.
2. Search for "Google Chat API" and enable it.

### 5-C: Configure the Chat app

1. Go to **APIs & Services → Google Chat API → Configuration**.
2. Fill in:
   - **App name**: Intake OS
   - **Description**: Submit project intake requests
   - **App URL**: `https://100.75.210.83/intake-sources/chat`
   - **Slash commands**: Add one — ID: `1`, Name: `/intake`, Description: "Submit a new project intake request", Open dialog: Yes
3. Under **Visibility**: select your Google Workspace domain.

### 5-D: Create a service account

1. Go to **IAM & Admin → Service Accounts**.
2. Create a new service account (e.g. `intake-os-chat@your-project.iam.gserviceaccount.com`).
3. No IAM roles needed.
4. Go to **Keys → Add Key → JSON** and download the file.

### 5-E: Put the key on the server

```bash
# From your local machine
scp service-account.json oreo@100.75.210.83:/home/oreo/intake-os/google-chat-service-account.json
ssh oreo@100.75.210.83
chmod 600 /home/oreo/intake-os/google-chat-service-account.json
```

Add to `.env.server`:
```
GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json
```

### 5-F: Install the app in Workspace (admin step)

1. Ask your Google Workspace admin to go to **Admin Console → Apps → Google Workspace Marketplace**.
2. Add the Chat app to the spaces where your team works.
   - Or individual users can add it manually: in a Chat space → Apps → Find the app.

### 5-G: Test it

Type `/intake` in a Chat space. A form should open with fields for title, description,
project type, and requester. Submitting should create a draft intake and post a
confirmation card with a link.

---

## Summary: What Goes in `.env.server`

Once all steps are complete, your `.env.server` should include these lines
(in addition to whatever is already there):

```bash
# Google Chat notifications (Step 1)
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...
INTAKE_APP_URL=https://100.75.210.83

# Monday (Step 2)
MONDAY_API_TOKEN=...
MONDAY_BOARD_ID=...
MONDAY_GROUP_ID=...
MONDAY_COLUMN_MAP_JSON={...}
MONDAY_API_VERSION=2026-04

# GitHub (Step 3)
GITHUB_PAT=ghp_...
GITHUB_ORG=Simple-biz
GITHUB_REPO_VISIBILITY=private
GITHUB_DEFAULT_TEAM_PREFIX=ds
GITHUB_CREATE_ISSUES=false

# Provisioning targets (both)
PROVISIONING_TARGETS=monday,github

# Email intake (Step 4)
INTAKE_EMAIL_SERVICE=postmark
INTAKE_WEBHOOK_SECRET=...
INTAKE_EMAIL_ADDRESS=intake@simple.biz

# Google Chat app intake (Step 5)
GOOGLE_CHAT_APP_CREDENTIALS_PATH=/home/oreo/intake-os/google-chat-service-account.json
```
