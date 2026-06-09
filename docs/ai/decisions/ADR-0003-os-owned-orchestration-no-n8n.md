# ADR-0003 — OS-Owned Orchestration, No n8n Runtime

## Status

Accepted.

## Context

The R&D brief listed n8n as a possible trigger/orchestration mechanism. The Project Intake OS is intended to be a controlled internal product, not a workflow glued together by an external automation runtime.

The OS needs to own:

- source normalization;
- workflow state;
- approval gates;
- AI prompt/schema boundaries;
- audit events;
- retries and idempotency;
- downstream distribution decisions;
- external resource tracking.

## Decision

Do not use n8n as Project Intake OS plumbing or orchestration.

Build source ingestion as native OS-owned adapters:

- manual web form / paste form first;
- native authenticated webhook endpoint later;
- native email parser later;
- Google Chat app later;
- Google Chat incoming webhook only for outbound notifications.

The OS may still classify or create projects whose implementation type is `n8n_automation`; it should not depend on n8n to operate its own lifecycle.

## Consequences

Positive:

- one source of workflow truth;
- simpler debugging model;
- controlled retry and audit semantics;
- no split-brain orchestration;
- less dependency on tooling outside the repo.

Tradeoff:

- source adapters require more code inside NestJS;
- webhook/email/Chat ingestion must be implemented intentionally rather than delegated.
