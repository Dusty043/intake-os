# R&D Decision Memo — Project Intake OS

## Decision

Proceed with the full Project Intake OS architecture. The R&D brief becomes the first validation workflow inside the larger platform.

## What We Are Building

The Project Intake OS is an internal control plane for project intake, AI-assisted analysis, human approval, assignment recommendation, downstream distribution preview, and eventually controlled provisioning.

It is not a one-off automation that simply converts messages into Monday items.

## Current Repo Reality

The uploaded codebase already contains a useful foundation:

- workflow state machine
- approval guard logic
- project type registry
- dry-run provisioning plan generation
- Bitrix24-shaped payload normalization seam
- NestJS API source
- Prisma schema
- Docker Compose baseline
- API contract docs
- build memory and sequence logs

The repo does not yet contain:

- Next.js frontend
- provider-backed AI analysis module; mock analysis draft is implemented for TASK-0005
- provider-backed model call
- roster API integration
- Monday board mapping
- GitHub live integration
- Google SSO
- Google Chat app integration
- email parser
- package lock
- verified API runtime smoke test

## Key R&D Findings

### Trigger strategy

Use the app-native web/manual intake path first. Add native OS-owned webhook, email, and Google Chat app adapters only after the core normalized intake contract is stable.

n8n is intentionally excluded from the target architecture because it would introduce a second workflow runtime and reduce control over retries, auditability, and integration behavior.

Google Chat incoming webhooks are useful for outbound notifications only. Interactive intake from Chat requires a Google Chat app or event subscription.

### AI strategy

Use structured output as the AI boundary. The model should generate a draft analysis that conforms to a schema. The backend validates the result and the user reviews it before any downstream creation.

### Monday strategy

Do not hardcode Monday column IDs in business logic. The target board must be inspected and mapped before live item creation. Store mapping config separately from workflow logic.

### GitHub strategy

Keep GitHub actions as preview/mocked provisioning before enabling live repository or issue creation. Live creation requires explicit org, token/app, repository visibility, labels, and idempotency decisions.

### Compliance strategy

Default to minimal retention. If inquiries may include PHI or regulated client data, require a BAA-approved AI provider path before processing real data.

## Recommended R&D Experiments

1. Analyze 10-20 recent Monday items and extract patterns.
2. Define canonical project type taxonomy.
3. Define structured AI analysis schema.
4. Run a model bakeoff using historical examples.
5. Inspect roster API shape and decide whether workload must be stored in the OS.
6. Inspect Monday board fields and create a mapping doc.
7. Generate a distribution preview from AI analysis output.

## Recommended MVP

A Next.js + NestJS internal app where a user can:

1. Submit or paste a project inquiry.
2. Run AI-assisted intake analysis.
3. Review and edit the generated brief, tasks, estimates, infra needs, and missing information.
4. Review suggested developer assignment.
5. Approve or reject the intake.
6. Generate a Monday/GitHub distribution preview.

Live Monday/GitHub writes should come after preview accuracy is trusted.

## Source Verification Snapshot

- Google Chat incoming webhooks are one-way notifications; interactive Chat intake requires a Chat app or events: https://developers.google.com/workspace/chat/quickstart/webhooks and https://developers.google.com/workspace/chat/receive-respond-interactions
- Monday item creation requires correct board/group/column mapping: https://developer.monday.com/api-reference/docs/create-item
- OpenAI Structured Outputs support schema-constrained model responses: https://platform.openai.com/docs/guides/structured-outputs
- GitHub org repo creation and issue creation require appropriate permissions: https://docs.github.com/en/rest/repos/repos and https://docs.github.com/en/rest/issues/issues
