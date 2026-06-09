# AI Cost Governance

## Purpose

This document defines AI usage controls, cost tracking, model tiering, regeneration limits, and operational cost governance for the Digital Solutions Project Intake OS.

The AI system should be useful, reviewable, and cost-aware.

AI usage must be traceable by request, evaluation, agent, model, and regeneration event.

---

## Core Philosophy

The system should use AI deliberately.

AI should help with:

- intake normalization
- clarification generation
- project classification
- architecture review
- implementation planning
- risk review
- effort estimation
- work breakdown generation
- final synthesis
- quality review

The system should avoid:

- unnecessary full regenerations
- running heavyweight models for lightweight tasks
- generating large outputs with no review value
- hiding AI spend from administrators
- making repeated AI calls without preserving results

---

## Model Tiering

The system should support multiple model tiers.

### Lower-Cost Models

Lower-cost models are recommended for:

- summarization
- classification
- clarification generation
- metadata extraction
- simple routing decisions
- formatting and cleanup
- lightweight quality checks

### Higher-Capability Models

Higher-capability models are recommended for:

- architecture generation
- implementation planning
- trade-off analysis
- complex evaluations
- risk reasoning
- issue generation
- final synthesis
- Critic / QA review for high-risk projects

### Model Selection Principle

Use the cheapest model that can reliably perform the required task.

Reserve higher-capability models for tasks where quality, reasoning, risk analysis, or implementation detail materially matters.

---

## Recommended Model Tier by Agent

| Agent | Recommended Model Tier |
|---|---|
| Intake Analyst Agent | Lower-cost |
| Clarification Agent | Lower-cost |
| Project Classifier Agent | Lower-cost or mid-tier |
| No-Code / Low-Code Agent | Mid-tier |
| Solutions Architect Agent | Higher-capability |
| Custom Build Agent | Higher-capability |
| Risk and Security Agent | Higher-capability |
| Cost and Effort Agent | Mid-tier or higher-capability |
| Work Breakdown Agent | Mid-tier or higher-capability |
| Distribution Planner Agent | Mid-tier |
| Final Synthesis Agent | Higher-capability |
| Critic / QA Agent | Higher-capability |

The exact model may vary by provider, but the tiering principle should stay consistent.

---

## Usage Tracking

The system should track AI usage at the agent-run level.

Each AI run should record:

- request ID
- evaluation ID
- agent name
- model provider
- model name
- model tier
- prompt version
- input token count
- output token count
- total token count
- estimated cost
- latency
- status
- error category, if failed
- triggering user or system worker
- created timestamp

Usage records should be linked to evaluation versions and regeneration history.

---

## Suggested AI Usage Record

```json
{
  "id": "airun_000123",
  "request_id": "REQ-000123",
  "evaluation_id": "EVAL-000456",
  "agent_name": "Solutions Architect Agent",
  "provider": "anthropic",
  "model": "example-model-name",
  "model_tier": "higher_capability",
  "prompt_version": "architect-v1",
  "input_tokens": 12000,
  "output_tokens": 2500,
  "total_tokens": 14500,
  "estimated_cost_usd": 0.42,
  "latency_ms": 18200,
  "status": "succeeded",
  "error_category": null,
  "triggered_by": "system",
  "created_at": "2026-05-16T00:00:00Z"
}
```

---

## Governance Controls

The system should support cost governance controls.

Recommended controls:

- monthly spend alerts
- per-request cost estimate
- per-evaluation cost estimate
- agent-level usage tracking
- regeneration limits
- token caps
- premium model restrictions
- evaluation size limits
- admin-visible usage reports
- warnings for unusually expensive evaluations

---

## Regeneration Cost Controls

Regeneration should be controlled and auditable.

The system should prefer section-level regeneration over full evaluation regeneration.

Supported regeneration scopes:

- clarification-only
- architecture-only
- risk-only
- cost-and-effort-only
- work-breakdown-only
- distribution-plan-only
- final-synthesis-only
- full evaluation

Each regeneration should record:

- regeneration scope
- reason
- triggering user
- model used
- token usage
- estimated cost
- prior version
- new version

Repeated full regenerations should be limited or require elevated permission.

---

## Suggested Default Limits

| Control | Suggested Default |
|---|---|
| Full regenerations per evaluation | 3 |
| Section regenerations per section | 5 |
| Monthly warning threshold | configurable |
| Premium model access | Intake Owner, DevOps Lead, Admin |
| Full evaluation with premium models | require Intake Owner or DevOps action |
| Regeneration after approval | blocked unless request returns to review state |

These defaults may be adjusted by Admin configuration.

---

## Cost Optimization Strategy

The system should optimize AI costs by:

- caching repeated evaluations where appropriate
- limiting unnecessary regenerations
- selecting models based on task complexity
- separating lightweight and heavyweight AI operations
- using structured schemas to reduce retries
- validating required intake fields before running expensive agents
- running only the agents required by evaluation depth
- preserving prior valid outputs instead of regenerating everything
- reusing agent outputs during final synthesis

---

## Admin Reporting Expectations

Admins should be able to view AI usage and cost trends.

The admin dashboard should show:

- total AI spend estimate by month
- spend by model
- spend by agent
- spend by project type
- spend by evaluation depth
- most expensive evaluations
- regeneration count
- failed AI calls
- average cost per evaluation
- average latency per agent
- token usage over time

The system should make unusually expensive evaluations visible.

---

## AI Cost Audit Rules

The system must audit:

- full evaluation generation
- section regeneration
- model tier selection
- premium model usage
- cost-threshold warnings
- failed AI calls
- manual override of cost limits
- changes to AI governance settings

Audit records should include:

- actor or system worker
- timestamp
- request ID
- evaluation ID
- action
- model
- estimated cost
- reason, when user-triggered

---

## Implementation Expectations

AI cost governance should be implemented as part of the AI orchestration layer.

Recommended implementation pieces:

- AI usage record model
- model registry
- model tier enum
- cost estimator
- token usage parser
- regeneration counter
- cost limit checker
- monthly usage aggregator
- admin usage dashboard
- premium model permission check
- audit logger

The first implementation may use estimated costs if exact billing data is not available.

Cost estimates should be clearly labeled as estimates.

---

## Required Tests

AI cost governance implementation must include tests for:

- lower-cost model selected for intake normalization by default
- higher-capability model selected for architecture review by default
- AI usage record is created for every agent run
- token usage is stored when provider returns it
- estimated cost is calculated when token usage is available
- failed AI calls still create usage records
- section regeneration increments regeneration count
- full regeneration limits are enforced
- premium model use requires authorized role
- evaluation depth controls which agents run
- monthly usage totals aggregate correctly
- cost-threshold warning is created when configured threshold is exceeded
- cost governance settings changes are audited

---

## Related Product Specs

- `docs/product/ai-orchestration.md`
- `docs/product/failure-and-recovery.md`
- `docs/product/permissions-and-ownership.md`
- `docs/product/project-type-registry.md`
