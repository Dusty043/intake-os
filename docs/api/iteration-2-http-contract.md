# Iteration 2.2 API Contract

## Scope

This document captures the safe POC HTTP boundary implemented by the NestJS API source under `apps/api`.

The API is intentionally safe:

- it persists intakes and audit events through Prisma/Postgres;
- it generates schema-backed mock analysis drafts only;
- it generates dry-run provisioning plans only;
- it does not call GitHub, Monday, Bitrix24, Google Chat, email, or live AI providers;
- it uses temporary actor headers instead of SSO.

## API docs

When the API is running, Swagger/OpenAPI is available at:

```text
GET /docs
```

Health check:

```http
GET /health
```

## Actor model for POC

Until SSO/RBAC is added, API calls may pass actor headers:

```text
x-actor-id: user-devops
x-actor-role: devops_lead
x-actor-name: DevOps Lead
```

If headers are omitted, the API defaults to a low-privilege `request_creator` actor.

Canonical roles:

```text
request_creator
intake_owner
devops_lead
developer
admin
```

## Endpoints

### Create manual intake

```http
POST /intakes
```

Body:

```json
{
  "title": "Project Intake OS",
  "description": "Internal intake and approval workflow.",
  "requester": "Digital Solutions",
  "department": "Internal Tools",
  "projectType": "internal_tool"
}
```

Creates a `draft` intake and writes `INTAKE_CREATED` to the audit trail.

### List intakes

```http
GET /intakes
```

Returns known project intake records from Postgres.

### Get intake

```http
GET /intakes/:id
```

Returns a single project intake record.

### Submit intake

```http
POST /intakes/:id/submit
```

Moves `draft` to `submitted`.

### Complete manual discovery

```http
POST /intakes/:id/discovery
```

Body:

```json
{
  "problemStatement": "Requests need governance before provisioning.",
  "stakeholders": ["Management", "DevOps"],
  "expectedUsers": ["Internal requesters"],
  "systemsTouched": ["GitHub", "Monday", "Bitrix24"],
  "dataSensitivity": "medium",
  "infraNeeds": ["Postgres", "container runtime"],
  "estimatedComplexity": "medium",
  "requiresGithub": true,
  "requiresMonday": true,
  "relatedToBitrix24": true
}
```

Manual discovery performs:

```text
submitted -> evaluating -> intake_review
```

### Generate mock analysis draft

```http
POST /intakes/:id/analysis-drafts/mock
```

Optional body:

```json
{
  "sourceInquiryText": "Client needs an internal dashboard for project throughput and developer workload.",
  "reviewerContext": "Internal-only first pass. Do not create live resources yet."
}
```

Mock analysis performs:

```text
submitted -> evaluating -> intake_review
```

It stores `analysisDrafts` and `latestAnalysisDraft` on the intake snapshot. The generated draft is review-only and cannot approve the intake or create a provisioning plan.

### Record approval

```http
POST /intakes/:id/approvals
```

Body:

```json
{
  "comment": "Approved for POC."
}
```

The open gate is inferred from state:

```text
intake_review -> Gate 1 -> devops_review
devops_review -> Gate 2 -> approved
```

### Reject approval gate

```http
POST /intakes/:id/rejections
```

Body:

```json
{
  "reason": "Scope is not ready for implementation."
}
```

### Generate dry-run provisioning plan

```http
POST /intakes/:id/provisioning-plan
```

Body:

```json
{
  "teamPrefix": "Digital Solutions",
  "existingRepositoryNames": [],
  "intakeRecordUrl": "https://intake-os.example/intakes/REQ-1"
}
```

Creates a dry-run plan only after both approvals. It does not call GitHub, Monday, or Bitrix24.

### Mark ready for provisioning

```http
POST /intakes/:id/provisioning-ready
```

Marks a valid dry-run plan as `ready_for_provisioning`. The intake remains in `approved` because live provisioning execution is out of scope for this slice.

### Read audit trail

```http
GET /intakes/:id/audit
```

Returns ordered audit events for the intake.

### Preview Bitrix24 intake

```http
POST /integrations/bitrix24/intake-preview
```

Accepts a Bitrix24-shaped payload and returns the normalized canonical intake input.

### Create intake from Bitrix24 payload

```http
POST /integrations/bitrix24/intakes
```

Normalizes the Bitrix24-shaped payload and creates a canonical intake with `source.system = bitrix24`.

## Explicitly not included yet

- live AI provider calls
- live GitHub repository creation
- live Monday board creation
- live Bitrix24 webhook registration or outbound sync
- SSO-backed RBAC
- queue workers and retry orchestration
