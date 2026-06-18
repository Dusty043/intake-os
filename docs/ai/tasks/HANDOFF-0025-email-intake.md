# Handoff: TASK-0025 — Email Intake Pipeline (Waiting on Service Choice)

**Written:** 2026-06-19
**Status:** BLOCKED — needs an inbound email service account and intake address
**Spec:** [TASK-0025-email-intake.md](./TASK-0025-email-intake.md)

---

## What This Handoff Is For

The code for email intake is fully designed. You set up an account with an inbound
email parsing service, get a webhook URL to configure on their end, and add three
env vars to `.env.server`. Once that's done, the endpoint can be built and deployed.

The endpoint itself (`POST /intake-sources/email`) is service-agnostic — the parser
normalizes the payload regardless of which service you choose.

---

## Open Questions — Decide Before Any Code

| # | Question | Why it matters |
|---|---|---|
| Q-E-1 | **Which inbound email service?** | Determines the request payload shape and signature verification method. All four options work. | 
| Q-E-2 | **What intake email address?** | Users will send project requests here. Something like `intake@simple.biz` or `projects@simple.biz`. Could also be an alias that forwards to the service. |
| Q-E-3 | **Should a confirmation reply go to the requester?** | "Your request was received" reply. Requires outbound email (SMTP or the same inbound service's outbound API). Optional for v1. |
| Q-E-4 | **Who reviews email-sourced intakes?** | They land in `draft` — intake owners promote them. Should they go into the same list or a separate admin review queue? Likely same list with a `source: email` filter is fine. |

---

## Choosing a Service (Q-E-1)

All four options are equivalent for this use case:

**Postmark** — recommended if starting from scratch
- Best webhook format, easy setup, HTTPS-only
- Free tier: 100 emails/month
- Sign up at postmarkapp.com → Inbound Processing
- You get a `@inbound.postmarkapp.com` address to forward to

**Cloudmailin** — simplest and cheapest
- $10/mo for 200 emails/month
- cloudmailin.com → you get a forwarding address immediately
- JSON webhook format, optional signing

**Mailgun Routes** — if already using Mailgun for other email
- Routes lets you forward `intake@yourdomain.com` directly to our endpoint
- Same account as outbound Mailgun
- mailgun.com

**SendGrid Inbound Parse** — if already on SendGrid
- Requires MX record change on your domain
- Free but webhook format is multipart/form-data (more complex to parse)

---

## What to Set Up

### 1. Create an account on your chosen service

Configure an inbound rule or forwarding address that sends email to:

```
https://100.75.210.83/intake-sources/email
```

(or your public Tailscale Funnel URL if it's different)

### 2. Get the signing secret

Every service provides a way to verify that a webhook is genuine. After creating
the inbound rule, grab the signing key or shared secret from the service dashboard.

### 3. Pick or create the intake email address

If you own `simple.biz`, you can:
- Create a real email address like `intake@simple.biz` in your email provider
- Set up a forwarding rule to the inbound service's address

Or just use the service-provided inbound address directly (e.g. `xyz@inbound.postmarkapp.com`)
and share that as the intake address.

---

## Env Vars for `.env.server`

```bash
ssh oreo@100.75.210.83
nano /home/oreo/intake-os/.env.server
```

Add:
```
INTAKE_EMAIL_SERVICE=postmark          # postmark | cloudmailin | mailgun | sendgrid
INTAKE_WEBHOOK_SECRET=...              # signing key from the service dashboard
INTAKE_EMAIL_ADDRESS=intake@simple.biz # for documentation purposes only
```

---

## What Gets Built Once These Are Decided

**`src/application/intake-sources/email-intake-parser.ts`** (~100 lines)
- Normalizes any inbound email webhook payload to `CreateIntakeInput`
- Handles subject stripping (Re:, Fwd:, [EXT])
- Deduplication by Message-ID
- Draft-first policy

**`apps/api/src/modules/intake/intake-sources.controller.ts`** (~60 lines)
- `POST /intake-sources/email`
- Signature validation per service
- Calls the parser → `workflowService.createIntake()`
- Returns `202 Accepted` with the new intake ID

Roughly 2 hours to implement once Q-E-1 and Q-E-2 are answered.

---

## Nothing Else Is Blocked

The email intake pipeline is fully independent of:
- Monday provisioning (TASK-0023D, needs Monday credentials)
- GitHub provisioning (TASK-0023E, needs GitHub credentials)
- Google Chat notifications (TASK-0024, already implemented — no credentials needed)
- Google Chat app intake (TASK-0026, needs GCP setup)

Email can ship any time after Q-E-1 and Q-E-2 are answered, regardless of whether
Monday and GitHub are live yet.
