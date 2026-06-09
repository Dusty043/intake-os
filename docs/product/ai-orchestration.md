# AI Orchestration

## Purpose

This document defines the AI-assisted evaluation pipeline for the Digital Solutions Project Intake OS.

The AI system transforms raw intake data into structured evaluations, clarification questions, implementation options, approval packets, work breakdowns, and distribution-ready handoff materials.

AI is an assisted evaluation layer.

AI does not approve projects.

Humans retain approval authority.

Architecture note: n8n is not used as Project Intake OS orchestration/plumbing. References to low-code evaluation are about the type of requested project or implementation recommendation, not about the OS runtime.

---

## Core Philosophy

The AI system should behave like a small internal review panel, not a single chatbot.

The system should separate:

- intake understanding
- requirement clarification
- project classification
- technical architecture
- low-code evaluation
- custom-build evaluation
- risk review
- cost and effort review
- work breakdown generation
- distribution planning
- final packet synthesis
- quality review

This improves:

- evaluation quality
- consistency
- explainability
- reviewability
- cost control
- failure recovery

---

## Agent Roles

| Agent | Purpose | Primary Question |
|---|---|---|
| Intake Analyst Agent | Normalize messy intake data into a structured brief | What is being asked for? |
| Clarification Agent | Identify missing, ambiguous, risky, or blocking information | What do we still need to know? |
| Project Classifier Agent | Classify project type, evaluation depth, risk, and distribution path | What kind of project is this? |
| Solutions Architect Agent | Recommend technical approach and architecture | How should this probably be built? |
| No-Code / Low-Code Agent | Evaluate n8n, Monday, SaaS tools, scripts, or lightweight automation paths | Can we avoid a full custom build? |
| Custom Build Agent | Evaluate custom software requirements | What does the engineering path look like? |
| Risk and Security Agent | Identify operational, technical, privacy, credential, and delivery risks | What could go wrong? |
| Cost and Effort Agent | Estimate build effort, AI cost, infrastructure cost, and maintenance burden | What will this cost? |
| Work Breakdown Agent | Generate epics, stories, issues, acceptance criteria, dependencies, and sequencing | What work needs to be done? |
| Distribution Planner Agent | Determine Monday and GitHub packaging and provisioning requirements | Where should this go after approval? |
| Final Synthesis Agent | Merge agent outputs into a human-readable evaluation packet | What should humans review? |
| Critic / QA Agent | Check final packet quality, gaps, contradictions, and readiness | Is this good enough to show an approver? |

---

## Evaluation Pipeline

### Stage 1 - Intake Normalization

Agents:

- Intake Analyst Agent
- Clarification Agent
- Project Classifier Agent

Goal:

Determine whether the request is complete enough to evaluate.

Possible outcomes:

- proceed to evaluation
- request clarification
- hold for manual review

### Stage 2 - Parallel Evaluation

Agents:

- Solutions Architect Agent
- No-Code / Low-Code Agent
- Custom Build Agent
- Risk and Security Agent
- Cost and Effort Agent

Goal:

Evaluate the request from multiple perspectives before recommending an implementation path.

Specialist agents may run in parallel after intake normalization is complete.

### Stage 3 - Recommendation and Work Breakdown

Agents:

- Final Synthesis Agent
- Work Breakdown Agent
- Distribution Planner Agent

Goal:

Turn the evaluation into a practical approval and handoff packet.

### Stage 4 - Quality Review

Agent:

- Critic / QA Agent

Goal:

Validate the final evaluation packet before it is shown to human reviewers.

The QA pass must check:

- required fields
- internal consistency
- unsupported assumptions
- missing risks
- unclear recommendations
- weak acceptance criteria
- invalid distribution logic

### Stage 5 - Human Review

Human reviewers decide whether to:

- approve
- reject
- request clarification
- edit the evaluation
- regenerate sections
- escalate to DevOps

AI does not approve projects.

---

## Evaluation Depths

Evaluation depth controls which agents run and how much detail is required.

### Light Evaluation

Use for:

- simple automations
- lightweight workflows
- operational tasks
- low-risk integrations

Recommended agents:

- Intake Analyst Agent
- Clarification Agent
- Project Classifier Agent
- No-Code / Low-Code Agent
- Risk and Security Agent
- Final Synthesis Agent
- Critic / QA Agent

Usually skip unless needed:

- Custom Build Agent
- Distribution Planner Agent
- Cost and Effort Agent

### Standard Evaluation

Use for:

- moderate integrations
- dashboards
- internal tools
- workflow orchestration

Recommended agents:

- Intake Analyst Agent
- Clarification Agent
- Project Classifier Agent
- Solutions Architect Agent
- No-Code / Low-Code Agent
- Custom Build Agent
- Risk and Security Agent
- Cost and Effort Agent
- Work Breakdown Agent
- Distribution Planner Agent
- Final Synthesis Agent
- Critic / QA Agent

### Full Evaluation

Use for:

- SaaS platforms
- client-facing portals
- sensitive systems
- infrastructure-heavy applications
- high-risk projects

Recommended agents:

- all Standard Evaluation agents
- deeper architecture pass
- deeper risk/security pass
- deeper cost pass
- deeper distribution planning
- expanded work breakdown

Full evaluations should require the strongest review and highest quality threshold.

---

## Shared Context Object

Agents should work from a shared structured context object rather than raw notes alone.

Suggested shape:

```json
{
  "request_id": "REQ-000123",
  "requester": {},
  "problem": "string",
  "goal": "string",
  "discovery_notes": "string",
  "systems_involved": [],
  "data_involved": [],
  "constraints": [],
  "deadline": "string | null",
  "budget_expectation": "string | null",
  "attachments": [],
  "known_assumptions": [],
  "prior_clarifications": [],
  "evaluation_depth": "light | standard | full"
}
```

The shared context should be versioned or traceable enough for reviewers to understand what information each agent used.

---

## Agent Output Contract

Every agent should return structured output.

Minimum shared fields:

```json
{
  "agent_name": "string",
  "summary": "string",
  "findings": [],
  "recommendations": [],
  "risks": [],
  "assumptions": [],
  "open_questions": [],
  "confidence": "high | medium | low",
  "blocking_flags": []
}
```

Specialist agents may include additional fields depending on their role.

Agent outputs must be persisted before synthesis so humans can inspect how the final packet was produced.

---

## Conditional Routing Rules

| Condition | System Behavior |
|---|---|
| Required intake fields missing | Run Clarification Agent and stop |
| Low project type confidence | Flag for Intake Owner review |
| Sensitive data detected | Require Risk and Security Agent review |
| GitHub required | Run Custom Build Agent and Distribution Planner Agent |
| No custom code likely | Prioritize No-Code / Low-Code Agent |
| Full evaluation depth | Run all specialist agents |
| Light evaluation depth | Run only core agents |
| Critic score below threshold | Regenerate weak sections or require manual review |

Routing should be deterministic and testable. Agents should not invent routing behavior that conflicts with the project type registry, workflow state machine, or distribution rules.

---

## Human Editing Workflow

AI-generated evaluations must support human editing.

Editable areas should include:

- architecture summaries
- implementation options
- risks
- assumptions
- epics
- stories
- acceptance criteria
- distribution recommendations

The system should support:

- manual overrides
- locked sections
- version comparison
- diff visibility
- approval comments
- section-level regeneration

AI should augment human workflows rather than replace them.

Human edits must not erase the original AI output. The system should preserve the AI-generated version, the edited version, the editor, the edit time, and any approval comments.

---

## Regeneration Strategy

Regeneration should be section-based whenever possible.

Supported regeneration types:

- full evaluation regeneration
- architecture-only regeneration
- risks-only regeneration
- clarification-only regeneration
- work-breakdown regeneration
- distribution-plan regeneration
- final-synthesis regeneration

The system should preserve:

- prior versions
- edit history
- regeneration reason
- model used
- cost estimate
- triggering user

Regeneration must not overwrite approved records without an explicit human action and audit trail.

---

## Quality Scoring

The Critic / QA Agent should produce a quality score before human review.

Suggested quality dimensions:

| Dimension | Meaning |
|---|---|
| Completeness | Required sections are present |
| Consistency | Recommendations do not contradict each other |
| Specificity | Evaluation is concrete enough to act on |
| Feasibility | Proposed solution is realistic |
| Risk Coverage | Major risks are identified |
| Handoff Readiness | DevOps/developer can act on it |

Suggested readiness bands:

| Score | Meaning |
|---|---|
| 90-100 | Ready for review |
| 70-89 | Usable with minor edits |
| 50-69 | Needs revision |
| Below 50 | Not ready |

A low quality score should block approval readiness or require manual review.

---

## Persistence and Versioning Expectations

The system should persist:

- the shared context object used by the evaluation
- individual agent outputs
- final synthesis output
- quality review output
- evaluation version number
- model and provider metadata
- token, cost, and latency metadata per agent run
- regeneration history
- human edits and comments
- approval-readiness status

Evaluation records should support traceability from final packet back to the contributing agent outputs.

For detailed AI usage and spend controls, see `docs/product/ai-cost-governance.md`.

---

## Implementation Expectations

The AI orchestration system should be implemented schema-first.

Required implementation rules:

- define evaluation schemas before connecting live AI providers
- implement mock AI providers before production providers
- persist every agent output
- validate every agent output before synthesis
- preserve evaluation versions
- support section-level regeneration
- store model, token, cost, and latency metadata per agent run
- record which agent outputs contributed to the final synthesis
- block approval review if the final packet fails required validation
- allow human edits without erasing the original AI output

---

## Required Tests

AI orchestration implementation must include tests for:

- required intake fields trigger clarification instead of full evaluation
- light evaluation runs only the expected core agents
- standard evaluation runs the standard agent set
- full evaluation runs expanded review
- sensitive data triggers Risk and Security Agent
- GitHub-required project types trigger Custom Build and Distribution Planner agents
- invalid agent JSON is rejected
- failed agent runs can be retried
- section regeneration preserves prior versions
- Critic / QA score below threshold blocks approval readiness
- human edits preserve original AI output and create version history

---

## Related Product Specs

- `docs/product/product-overview.md`
- `docs/product/workflow-state-machine.md`
- `docs/product/project-type-registry.md`
- `docs/product/distribution-rules.md`
- `docs/product/ai-cost-governance.md`
- `docs/product/requirements-trace.md`
