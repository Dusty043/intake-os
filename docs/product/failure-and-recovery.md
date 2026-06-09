# Failure and Recovery

## Purpose

This document defines how the Digital Solutions Project Intake OS handles failures, retries, dead-letter jobs, partial success, and manual recovery.

The system should make failures visible, recoverable, inspectable, and safe to retry.

Failures must not silently disappear.

Retries must not create duplicate downstream resources.

---

## Failure Philosophy

The system should favor:

- recoverability
- retryability
- observability
- partial success handling
- explicit failure states
- safe manual intervention

The system should avoid:

- silent failures
- destructive retries
- duplicate provisioning
- hidden background errors
- irreversible state transitions without audit history

---

## Failure Categories

| Failure Type | Example |
|---|---|
| AI Failure | Invalid JSON, timeout, provider error, malformed agent output |
| Validation Failure | Missing required fields, invalid project type, unresolved distribution mode |
| Approval Failure | Invalid transition, Gate 2 attempted before Gate 1 |
| Provisioning Failure | GitHub API error, Monday item creation failure |
| Authentication Failure | Expired token, missing credentials, revoked integration access |
| Integration Failure | Monday unavailable, GitHub unavailable, API schema mismatch |
| Collision Failure | Repo already exists, Monday item already created, duplicate external ID |
| Rate Limit Failure | Provider or integration API rate limit |
| Worker Failure | Background job crashed or timed out |
| Configuration Failure | Missing board ID, missing repo org, missing model config |

---

## Retry Strategy

Recommended retry behavior:

| Failure Type | Retry Strategy |
|---|---|
| Transient API Failure | Automatic retry |
| Rate Limit | Exponential backoff |
| Validation Failure | Manual correction |
| Collision Failure | Manual intervention |
| Authentication Failure | Re-authentication required |
| Configuration Failure | Admin correction required |
| AI Output Failure | Retry agent or regenerate section |
| Approval Failure | Block action and show reason |
| Partial Provisioning Failure | Retry failed steps only when possible |

---

## Retry Principles

Retries must be safe.

The system should:

- retry only when the action is idempotent or can be made idempotent
- preserve the original job payload
- preserve prior attempts
- record retry count
- record retry reason
- record actor or system worker that triggered the retry
- avoid retrying validation failures until data is corrected
- avoid retrying authentication failures until credentials are refreshed
- avoid creating duplicate external resources

---

## Dead-Letter Handling

Repeated failures should move jobs into a dead-letter state.

Dead-letter jobs should:

- remain inspectable
- preserve original payloads
- preserve all attempt history
- preserve error messages
- preserve external IDs already created
- support replay after correction
- notify administrators or surface in the admin dashboard

A dead-letter job should not be deleted automatically.

Manual replay should require an authorized user and a recorded reason.

---

## AI Evaluation Failures

AI evaluation failures may include:

- provider timeout
- provider API error
- invalid JSON
- schema validation failure
- missing required agent fields
- hallucinated unsupported values
- Critic / QA score below threshold

Expected behavior:

- preserve failed agent output when available
- record provider, model, timestamp, and error
- allow retry of failed agent
- allow section-level regeneration
- avoid discarding previous valid evaluation versions
- block approval readiness if final evaluation packet is invalid
- surface failure reason to Intake Owner or Admin

AI failures should not automatically reject a request.

---

## Validation Failures

Validation failures occur when required product rules are not satisfied.

Examples:

- missing required intake fields
- unresolved project type
- unresolved GitHub requirement
- unresolved distribution mode
- missing approval record
- missing Monday configuration
- missing GitHub configuration
- invalid repo name
- unresolved blocking open questions

Expected behavior:

- block the attempted action
- explain what must be corrected
- avoid background retries until corrected
- record the validation failure if it occurs during a workflow action
- keep the request in its current safe state

---

## Approval Failures

Approval failures occur when a user or process attempts an invalid approval action.

Examples:

- Gate 2 attempted before Gate 1
- unauthorized user attempts approval
- approval attempted from invalid state
- approval attempted on archived request
- mutation attempted on locked approval record

Expected behavior:

- reject the action
- preserve current state
- show clear reason
- write an audit event for attempted invalid approval when appropriate
- never partially complete an approval

---

## Provisioning Failures

Provisioning failures occur while creating downstream resources.

Examples:

- GitHub repo creation fails
- GitHub issue creation fails
- Monday item creation fails
- Monday subitem creation fails
- external API returns unexpected response
- external resource already exists
- network timeout occurs after resource creation

Expected behavior:

- mark failed step as failed
- preserve successful steps
- preserve external IDs for successful resources
- preserve original distribution package
- allow retry of failed steps
- avoid duplicate resources during retry
- move request to `provisioning_failed` if provisioning cannot complete
- surface failure in admin dashboard

Provisioning workers should operate from a frozen distribution package, not mutable intake fields.

---

## Authentication Failures

Authentication failures occur when credentials or access tokens are missing, expired, revoked, or insufficient.

Expected behavior:

- stop the affected job
- mark failure as authentication-related
- do not retry automatically until credentials are fixed
- notify or surface to Admin
- preserve payload and attempt history
- allow replay after re-authentication

The system must not log secrets or tokens.

---

## Collision Failures

Collision failures occur when the system detects a resource conflict.

Examples:

- GitHub repo name already exists
- Monday item already exists
- external ID already stored for a different request
- duplicate provisioning job attempts to create the same resource

Expected behavior:

- stop the conflicting step
- preserve current state
- show collision details
- require manual resolution
- avoid automatic duplicate creation
- allow authorized user to link existing resource when appropriate
- audit the resolution

---

## Partial Success Handling

Partial success is expected during provisioning.

Example:

- Monday project item created successfully
- Monday epics partially created
- GitHub repo creation failed
- GitHub issues not created yet

The system should preserve partial success instead of rolling back blindly.

Partial success records should include:

- completed steps
- failed steps
- skipped steps
- external IDs created
- retry eligibility
- manual recovery options

Retries should resume from the last safe point when possible.

---

## Manual Recovery

Manual recovery may be required for:

- collisions
- authentication failures
- configuration failures
- repeated provider failures
- ambiguous partial provisioning
- external resources created outside the system

Manual recovery actions may include:

- retry failed step
- retry full job
- mark step as manually completed
- link existing external resource
- skip optional step
- cancel remaining provisioning
- archive failed request
- restore request if permitted

Manual recovery must record:

- actor
- timestamp
- reason
- affected request
- affected job
- previous state
- new state
- external resource references, if applicable

---

## Admin Dashboard Expectations

Failures must be visible to authorized users.

The admin dashboard should show:

- failed AI jobs
- failed provisioning jobs
- dead-letter jobs
- failed integration calls
- authentication/configuration issues
- retry count
- last error message
- current state
- next recommended action
- links to request, evaluation, provisioning job, and audit history

Admin users should be able to inspect failures without needing direct database access.

---

## Worker and Job Expectations

Background jobs should be durable and inspectable.

Each job should track:

- job ID
- request ID
- job type
- status
- payload
- current attempt
- max attempts
- created timestamp
- started timestamp
- completed timestamp
- failed timestamp
- error message
- error category
- retry eligibility
- dead-letter status

Recommended job statuses:

- `queued`
- `running`
- `succeeded`
- `failed`
- `retrying`
- `dead_lettered`
- `canceled`

---

## Failure Audit Rules

The system must audit:

- failed workflow transitions
- failed approvals
- failed AI runs
- failed provisioning steps
- retries
- dead-letter transitions
- manual recovery actions
- linked external resources
- skipped provisioning steps
- canceled jobs

Audit records should include:

- actor or system worker
- timestamp
- request ID
- job ID when applicable
- action
- result
- previous state
- next state
- error category
- error summary

---

## Implementation Expectations

Failure and recovery should be implemented as a first-class system concern.

Recommended implementation pieces:

- job model
- job attempt model
- provisioning step model
- error category enum
- retry policy helper
- dead-letter handler
- manual recovery service
- admin failure dashboard
- audit logger
- integration error normalization
- idempotency helpers
- external resource lookup helpers

Errors from external APIs should be normalized into internal failure categories before being stored.

---

## Required Tests

Failure and recovery implementation must include tests for:

- transient failures are retried
- rate limits use retry/backoff behavior
- validation failures are not retried automatically
- authentication failures require credential correction
- repeated failures move job to dead-letter state
- dead-letter jobs preserve payload and attempts
- manual replay requires authorized user
- provisioning retry does not duplicate existing Monday items
- provisioning retry does not duplicate existing GitHub repositories
- partial provisioning preserves successful external IDs
- collision failures require manual intervention
- invalid approval transitions preserve current state
- failed AI output preserves prior valid evaluation versions
- section-level regeneration preserves previous versions
- all retries and manual recovery actions create audit events
