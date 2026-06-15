# Requirements Trace

## Purpose

This document maps the original appendix requirements into product specifications, implementation areas, task IDs, and test expectations.

It exists to ensure that appendix requirements are not lost during implementation.

The requirements trace should be updated when:

- product specs are created or changed
- implementation tasks are added
- requirements are deferred
- requirements are completed
- tests are added
- behavior is intentionally changed

---

## Status Values

| Status | Meaning |
|---|---|
| `not_started` | Requirement has not been implemented yet |
| `specified` | Requirement is documented in a product spec |
| `in_progress` | Implementation work has started |
| `implemented` | Behavior exists in code |
| `tested` | Automated or manual tests cover the behavior |
| `deferred` | Requirement is intentionally postponed |
| `changed` | Requirement changed from the appendix version |
| `open_question` | Requirement needs a human decision |

---

## Coverage Summary

| Appendix | Area | Requirements | Specified | Implemented | Tested | Open Questions |
|---|---|---:|---:|---:|---:|---:|
| A | Workflow State Machine | 13 | 13 | 10 | 10 | 1 |
| B | AI Orchestration | 12 | 12 | 2 | 2 | 0 |
| C | Project Type Registry | 8 | 8 | 8 | 8 | 0 |
| D | Distribution Rules | 8 | 8 | 3 | 2 | 0 |
| E | Permissions and Ownership | 8 | 8 | 7 | 7 | 0 |
| F | Failure and Recovery | 9 | 9 | 0 | 0 | 0 |
| G | AI Cost Governance | 7 | 7 | 0 | 0 | 0 |
| H | Repository and Naming | 5 | 5 | 4 | 4 | 0 |
| I | Post-Distribution Lifecycle | 4 | 4 | 0 | 0 | 0 |

The numbers can be adjusted as the trace becomes more detailed.

---

## Requirement Trace Table Format

| ID | Source | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| A-001 | Appendix A | Workflow engine controls intake, evaluation, approval, provisioning, and distribution | `workflow-state-machine.md` | State machine, request lifecycle | TASK-0007 | State transition tests | specified |  |

---

## Appendix A — Workflow State Machine

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| A-001 | Workflow engine is the authoritative process controller | `workflow-state-machine.md` | Workflow engine | TASK-0001, TASK-0007 | `tests/workflow.test.mjs` lifecycle transition tests | tested | Domain state machine foundation added in TASK-0001. |
| A-002 | Requests begin in `draft` and cannot evaluate, approve, provision, or distribute | `workflow-state-machine.md` | Request status guards | TASK-0001, TASK-0007 | `tests/workflow.test.mjs` blocked action tests | tested | Draft invalid transition guard added in TASK-0001. |
| A-003 | Submitted requests can generate evaluation or request clarification | `workflow-state-machine.md` | Evaluation trigger guards | TASK-0001, TASK-0007, TASK-0010 | `tests/workflow.test.mjs` submitted-state tests | tested | Canonical transition table added in TASK-0001. |
| A-004 | Evaluating state locks approval, provisioning, distribution, and locked intake edits | `workflow-state-machine.md` | Evaluation job state | TASK-0007, TASK-0010 | locked-field tests | specified |  |
| A-005 | Clarification required supports edits, answers, resubmission, and override | `workflow-state-machine.md` | Clarification workflow | TASK-0019 | clarification transition tests | specified | Override policy still needs final role decision |
| A-006 | Gate 1 approval moves request to DevOps Review | `workflow-state-machine.md` | Approval workflow | TASK-0001, TASK-0020 | `tests/workflow.test.mjs` Gate 1 transition tests | tested | Gate 1 approval record creation and lock added in TASK-0001. |
| A-007 | Gate 2 approval moves request to Approved | `workflow-state-machine.md` | Approval workflow | TASK-0001, TASK-0021 | `tests/workflow.test.mjs` Gate 2 transition tests | tested | Gate 2 blocked until Gate 1 is complete. |
| A-008 | Approved state allows package generation and provisioning validation | `workflow-state-machine.md`, `distribution-rules.md` | Dry-run provisioning plan service | TASK-0001, TASK-0002, TASK-0023 | `tests/workflow.test.mjs` package validation guard tests; `tests/intake-workflow-service.test.mjs` plan generation tests | tested | Iteration 2 generates and validates dry-run provisioning plans only; live execution remains deferred. |
| A-009 | Provisioning creates downstream resources and supports retries | `workflow-state-machine.md`, `distribution-rules.md` | Provisioning worker | TASK-0027–TASK-0037 | retry/idempotency tests | specified |  |
| A-010 | Provisioning failed supports retry, recovery, manual intervention, and archive | `failure-and-recovery.md` | Recovery workflow | TASK-0031, TASK-0037, TASK-0039 | recovery tests | specified |  |
| A-011 | Distributed state blocks reprovision without explicit override | `workflow-state-machine.md`, `distribution-rules.md` | Provisioning guard | TASK-0023 | reprovision guard tests | specified |  |
| A-012 | Approval records are immutable after completion | `workflow-state-machine.md`, `permissions-and-ownership.md` | Approval model | TASK-0001, TASK-0006, TASK-0022 | `tests/workflow.test.mjs` approval lock assertions | tested | Approval records created by workflow are locked. |
| A-013 | All state transitions are timestamped and audited | `workflow-state-machine.md` | Audit log | TASK-0001, TASK-0002, TASK-0022 | `tests/workflow.test.mjs` audit event tests; `tests/intake-workflow-service.test.mjs` audit trail tests | tested | Iteration 2 adds an append/list audit store contract and verifies the full MVP audit sequence. |
| A-014 | Clarification UI shows prior answers, validates required fields, and disables submit until complete | `workflow-state-machine.md` | ClarificationPanel (web) | TASK-0021 | manual UI verification | tested | Grouping, inline validation, prior answers, and success/error state added in TASK-0021. |

---

## Appendix B — Multi-Agent AI Orchestration

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| B-001 | AI operates as assisted evaluation layer, not decision-maker | `ai-orchestration.md`, `intake-analysis-schema.md` | Evaluation workflow | TASK-0005, TASK-0015–TASK-0018 | `tests/intake-analysis-draft.test.mjs` draft-only and provisioning-blocking tests | tested | Mock analysis output remains draft-only and cannot approve or provision. |
| B-002 | AI pipeline uses specialized agents, not one monolithic prompt | `ai-orchestration.md` | AI orchestrator | TASK-0016, TASK-0017 | orchestrator routing tests | specified |  |
| B-003 | Intake Analyst normalizes messy requests | `ai-orchestration.md` | Intake agent | TASK-0017 | agent output schema tests | specified |  |
| B-004 | Clarification Agent identifies blockers and missing info | `ai-orchestration.md` | Clarification flow | TASK-0019 | missing-field tests | specified |  |
| B-005 | Project Classifier assigns project type and depth | `ai-orchestration.md`, `project-type-registry.md` | Classification service | TASK-0015, TASK-0017 | classifier tests | specified |  |
| B-006 | Specialist agents evaluate architecture, low-code, custom build, risk, cost | `ai-orchestration.md` | AI agent runner | TASK-0017 | depth routing tests | specified |  |
| B-007 | Final Synthesis Agent produces human-readable review packet | `ai-orchestration.md` | Synthesis service | TASK-0018 | synthesis validation tests | specified |  |
| B-008 | Critic / QA Agent scores completeness and readiness | `ai-orchestration.md` | QA evaluator | TASK-0018 | low-score blocking tests | specified |  |
| B-009 | Agent outputs use shared structured contract | `ai-orchestration.md`, `intake-analysis-schema.md` | Agent schema | TASK-0005, TASK-0015 | `tests/intake-analysis-draft.test.mjs`, `tests/openai-intake-analysis-provider.test.mjs`, `tests/anthropic-intake-analysis-provider.test.mjs`, `tests/bedrock-intake-analysis-provider.test.mjs` | tested | `IntakeAnalysisDraft` v1 schema validated. Real provider adapters use `AnalysisDraftModelOutput` schema and `mapModelOutputToDraft` to enforce contract across all providers. TASK-0015. |
| B-010 | Shared context object is used across agents | `ai-orchestration.md` | AI context builder | TASK-0016 | context construction tests | specified |  |
| B-011 | Section-level regeneration preserves prior versions | `ai-orchestration.md`, `intake-analysis-schema.md` | Evaluation versioning | TASK-0005, TASK-0018 | version preservation tests | in_progress | TASK-0005 stores generated drafts as an array plus latest pointer; accept/reject/supersede behavior remains TASK-0006+. |
| B-012 | AI usage tracks model, token, regeneration, and cost metadata | `ai-cost-governance.md` | AI usage logging | TASK-0040 | usage record tests | specified |  |
| B-013 | Evaluation results are readable via API by authorized reviewers | `ai-orchestration.md` | Evaluation read routes | TASK-0021 | `tests/evaluation-api-read.test.mjs` | tested | `GET /intakes/:id/evaluations`, `/latest`, `/:evaluationId` routes implemented. |
| B-014 | Evaluation UI shows all 12 section kinds with agent provenance | `ai-orchestration.md` | EvaluationSectionCard, EvaluationPanel | TASK-0021 | manual UI verification | tested | `EvaluationPanel` + `EvaluationSectionCard` with 12 renderers deployed. |
| B-015 | Quality score and readiness band are displayed to reviewers | `ai-orchestration.md` | EvaluationPanel | TASK-0021 | manual UI verification | tested | `QualityScoreBadge` and `QualityScoreBreakdown` components in `EvaluationPanel`. |
| B-016 | Reviewers can trigger evaluation regeneration from the UI | `ai-orchestration.md` | EvaluationRegenerateForm | TASK-0021 | manual UI verification | tested | `EvaluationRegenerateForm` integrated in Evaluation tab; calls `regenerateAnalysisDraft`. |

---

## Appendix C — Project Type Registry

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| C-001 | Project types drive depth, provisioning, GitHub, Monday, risk, routing, templates | `project-type-registry.md` | Project type registry | TASK-0001, TASK-0015 | `tests/project-type-registry.test.mjs` registry tests | tested | Registry foundation includes depth, GitHub, distribution mode, and repo segment defaults. |
| C-002 | Canonical project types are centrally managed | `project-type-registry.md` | Config or seed data | TASK-0001, TASK-0015 | `tests/project-type-registry.test.mjs` canonical type tests | tested | Central TypeScript registry added. |
| C-003 | n8n Automation defaults to Light, GitHub No, Mode C | `project-type-registry.md` | Registry seed | TASK-0001, TASK-0015 | `tests/project-type-registry.test.mjs` default tests | tested |  |
| C-004 | Internal Tool defaults to Standard, GitHub Yes, Mode B | `project-type-registry.md` | Registry seed | TASK-0001, TASK-0015 | `tests/project-type-registry.test.mjs` default tests | tested |  |
| C-005 | Client Portal and SaaS Platform default to Full and GitHub Yes | `project-type-registry.md` | Registry seed | TASK-0001, TASK-0015 | `tests/project-type-registry.test.mjs` default tests | tested | Client Portal covered directly; SaaS Platform included in registry. |
| C-006 | Discovery / Research defaults to Light, GitHub No, Mode None | `project-type-registry.md` | Registry seed | TASK-0001, TASK-0015 | `tests/project-type-registry.test.mjs` default tests | tested |  |
| C-007 | Optional GitHub requirement must be resolved before provisioning | `project-type-registry.md`, `distribution-rules.md` | Distribution validation | TASK-0001, TASK-0023 | `tests/project-type-registry.test.mjs` unresolved optional GitHub tests | tested | Helper added; live distribution validation still deferred. |
| C-008 | Evaluation depth controls required evaluation detail | `project-type-registry.md`, `ai-orchestration.md` | AI routing | TASK-0001, TASK-0017 | `tests/project-type-registry.test.mjs` depth-routing tests | tested | Required section helper added; AI routing service deferred. |

---

## Appendix D — Distribution Rules

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| D-001 | Custom app remains pre-distribution control plane | `distribution-rules.md` | Product boundary | TASK-0002, TASK-0023 | `tests/intake-workflow-service.test.mjs` dry-run readiness tests | tested | Iteration 2 keeps provisioning as dry-run plan actions and does not call downstream systems. |
| D-002 | Monday and GitHub are execution destinations | `distribution-rules.md` | Dry-run distribution planner | TASK-0002, TASK-0024–TASK-0037 | `tests/intake-workflow-service.test.mjs` action system tests | tested | GitHub and Monday are represented as dry-run provisioning actions only. |
| D-003 | Mode B sends project and epics to Monday | `distribution-rules.md` | Monday payload generator | TASK-0024 | Mode B payload tests | specified |  |
| D-004 | Mode C sends project, epics, stories, subtasks, acceptance criteria, dependencies | `distribution-rules.md` | Monday payload generator | TASK-0024, TASK-0030 | Mode C payload tests | specified |  |
| D-005 | GitHub only provisioned when custom code or engineering ownership is required | `distribution-rules.md` | GitHub dry-run guard | TASK-0002, TASK-0025, TASK-0033 | `tests/intake-workflow-service.test.mjs` dry-run plan tests | tested | Plan generation resolves project-type GitHub requirement using discovery input before adding GitHub actions. |
| D-006 | Provisioning stores external IDs | `distribution-rules.md` | External resource model | TASK-0002, TASK-0008, TASK-0027–TASK-0037 | schema review | implemented | Prisma schema includes external links and source external IDs; live resource creation and tests remain deferred. |
| D-007 | Provisioning retries must not create duplicates | `distribution-rules.md`, `failure-and-recovery.md` | Idempotency service | TASK-0031, TASK-0037 | duplicate-prevention tests | specified |  |
| D-008 | Provisioning failures support retries, recovery, manual intervention, rollback where practical | `distribution-rules.md`, `failure-and-recovery.md` | Recovery workflow | TASK-0039 | recovery tests | specified |  |

---

## Appendix E — Permissions and Ownership

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| E-001 | Canonical roles include Creator, Intake Owner, DevOps Lead, Developer, Admin | `permissions-and-ownership.md` | Role enum | TASK-0001, TASK-0038 | `tests/permissions.test.mjs` role/permission tests | tested |  |
| E-002 | Request Creator can create, edit draft, and submit | `permissions-and-ownership.md` | Permission guards | TASK-0001, TASK-0038 | `tests/permissions.test.mjs` permission tests | tested |  |
| E-003 | Request Creator cannot generate evaluation or approve | `permissions-and-ownership.md` | Permission guards | TASK-0001, TASK-0038 | `tests/permissions.test.mjs` denial tests | tested |  |
| E-004 | Intake Owner can generate evaluation and approve Gate 1 | `permissions-and-ownership.md` | Permission guards | TASK-0001, TASK-0020, TASK-0038 | `tests/permissions.test.mjs` Gate 1 permission tests | tested |  |
| E-005 | DevOps Lead can approve Gate 2 and trigger provisioning | `permissions-and-ownership.md` | Permission guards | TASK-0001, TASK-0021, TASK-0038 | `tests/permissions.test.mjs` Gate 2/provisioning tests | tested |  |
| E-006 | Developer consumes distributed work but cannot approve/provision | `permissions-and-ownership.md` | Permission guards | TASK-0001, TASK-0038 | `tests/permissions.test.mjs` denial tests | tested |  |
| E-007 | Admin manages system configuration and governance | `permissions-and-ownership.md` | Admin permission model | TASK-0001, TASK-0038 | `tests/permissions.test.mjs` admin tests | tested |  |
| E-008 | Ownership transfers from Intake Owner to DevOps after Gate 1 | `permissions-and-ownership.md` | Ownership assignment | TASK-0020, TASK-0021 | ownership transition tests | specified |  |

---

## Appendix F — Failure and Recovery

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| F-001 | System favors recoverability, retryability, observability, partial success | `failure-and-recovery.md` | Job/recovery model | TASK-0039 | recovery behavior tests | specified |  |
| F-002 | Failure categories include AI, validation, approval, provisioning, auth, integration, collision | `failure-and-recovery.md` | Error category enum | TASK-0039 | error category tests | specified |  |
| F-003 | Transient API failures retry automatically | `failure-and-recovery.md` | Retry policy | TASK-0039 | retry tests | specified |  |
| F-004 | Rate limits use exponential backoff | `failure-and-recovery.md` | Retry policy | TASK-0039 | backoff tests | specified |  |
| F-005 | Validation failures require manual correction | `failure-and-recovery.md` | Validation workflow | TASK-0039 | non-retry tests | specified |  |
| F-006 | Authentication failures require re-authentication | `failure-and-recovery.md` | Integration auth handling | TASK-0039 | auth failure tests | specified |  |
| F-007 | Collision failures require manual intervention | `failure-and-recovery.md` | Collision handler | TASK-0039 | collision tests | specified |  |
| F-008 | Repeated failures move to dead-letter state | `failure-and-recovery.md` | Dead-letter handler | TASK-0039 | dead-letter tests | specified |  |
| F-009 | Dead-letter jobs preserve payload and support replay | `failure-and-recovery.md` | Job model | TASK-0039 | replay tests | specified |  |

---

## Appendix G — AI Cost Governance

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| G-001 | System tracks tokens, model usage, cost estimates, regeneration count, monthly usage | `ai-cost-governance.md` | AI usage model | TASK-0040 | usage logging tests | specified |  |
| G-002 | Lower-cost models used for summarization, classification, clarification, extraction | `ai-cost-governance.md` | Model router | TASK-0040 | model selection tests | specified |  |
| G-003 | Higher-capability models used for architecture, planning, trade-offs, issue generation | `ai-cost-governance.md` | Model router | TASK-0040 | model selection tests | specified |  |
| G-004 | Monthly spend alerts supported | `ai-cost-governance.md` | Cost monitor | TASK-0040 | threshold tests | specified |  |
| G-005 | Regeneration limits supported | `ai-cost-governance.md` | Regeneration service | TASK-0040 | limit tests | specified |  |
| G-006 | Premium model access can be restricted | `ai-cost-governance.md` | Permission checks | TASK-0040 | premium permission tests | specified |  |
| G-007 | Cost optimization prefers task-appropriate models and section regeneration | `ai-cost-governance.md` | AI orchestration | TASK-0040 | routing/regeneration tests | specified |  |

---

## Appendix H — Repository and Naming Strategy

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| H-001 | Repo naming format is `<team>-<project-type>-<project-name>` | `repository-and-naming.md` | Naming service | TASK-0001, TASK-0033 | `tests/repository-naming.test.mjs` naming tests | tested |  |
| H-002 | Repo names are human-readable and avoid collisions | `repository-and-naming.md` | Naming/collision service | TASK-0001, TASK-0033 | `tests/repository-naming.test.mjs` collision tests | tested |  |
| H-003 | Reusable repo templates are supported | `repository-and-naming.md` | Template registry | TASK-0033 | template tests | specified |  |
| H-004 | Initial labels include bug, enhancement, infrastructure, backend, frontend, automation, ai, blocked, needs-review | `repository-and-naming.md` | Label generator | TASK-0001, TASK-0034 | `tests/repository-naming.test.mjs` label tests | tested |  |
| H-005 | Generated README includes summary, approved goal, architecture, setup, environment, links | `repository-and-naming.md` | README generator | TASK-0001, TASK-0035 | `tests/repository-naming.test.mjs` README tests | tested |  |

---

## Appendix I — Post-Distribution Lifecycle

| ID | Requirement | Product Spec | Implementation Area | Related Tasks | Test Coverage | Status | Notes |
|---|---|---|---|---|---|---|---|
| I-001 | System avoids deep bidirectional synchronization | `post-distribution-lifecycle.md` | Lifecycle model | TASK-0043 or later | sync-boundary tests | specified |  |
| I-002 | App tracks high-level statuses: Distributed, In Progress, Blocked, Completed, Archived, Canceled | `post-distribution-lifecycle.md` | Lifecycle status enum | TASK-0043 or later | status tests | specified |  |
| I-003 | App tracks closure metadata, completion timestamps, downstream links | `post-distribution-lifecycle.md` | Project lifecycle model | TASK-0043 or later | metadata tests | specified |  |
| I-004 | App does not mirror issue-level updates, PRs, every Monday field, or developer activity | `post-distribution-lifecycle.md` | Integration boundary | TASK-0043 or later | no-deep-sync guard tests | specified |  |

---

## Gap Register

| Gap ID | Related Requirement | Gap | Owner | Status | Notes |
|---|---|---|---|---|---|
| GAP-001 | A-005 | Clarification override authority needs final role decision | Product/Admin | open | Recommend DevOps Lead or Admin only |
| GAP-002 | A-011 | Reprovision override policy needs final approval | DevOps/Admin | open | Must prevent duplicate downstream resources |
| GAP-003 | H-001 | Approved team prefixes are not finalized | DevOps/Admin | open | Examples: `ds`, `ops`, `client`, `internal` |
| GAP-004 | H-002 | GitHub org and repo privacy defaults are not finalized | DevOps/Admin | open | Needed before live GitHub provisioning |
| GAP-005 | I-004 | Automated post-distribution signals are not confirmed for v1 | DevOps/Admin | open | Manual lifecycle updates are safer for v1 |
| GAP-006 | Bitrix24 source intake | Live Bitrix24 webhook/auth model is not confirmed | DevOps/Admin | open | Iteration 2 only normalizes sample payloads and creates canonical intakes |

---

## Maintenance Rules

When an agent creates or modifies implementation related to appendix requirements, it must update this file.

Required updates:

- change requirement status when implemented
- add related task IDs
- add test references once tests exist
- mark requirements as deferred only with human reason
- add gaps when implementation policy is unclear
- link ADRs when a requirement changes materially
