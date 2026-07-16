# Project Epic and Task Breakdown

**Task:** TASK-0067  
**Source branch:** `main` at `83d87ea` (2026-07-16)  
**GitHub issue:** [#38](https://github.com/Dusty043/intake-os/issues/38)  
**Status:** Historical sizing baseline; estimates are relative, not time promises.

## Sizing rule

Use Fibonacci story points: **1, 2, 3, 5, 8, 13**. Estimate leaf tasks, then add them upward. Do not assign a guessed point value to a whole project or epic.

| SP | Meaning |
|---:|---|
| 1–2 | Tiny, well-understood change |
| 3 | Small, bounded task |
| 5 | Medium task with some unknowns |
| 8 | Large; consider splitting |
| 13 | Very large or fuzzy; split before sprint planning |

An epic total is the sum of its tasks. These are retrospective planning equivalents, not measured historical effort or elapsed hours.

## History traced

The commit history shows this sequence:

1. **Foundation:** TASK-0001 through TASK-0003 established the domain, iteration-2 runtime, and NestJS API.
2. **Usable intake flow:** TASK-0004 through TASK-0014P added analysis drafts, review, approval guards, the review UI, persistence, and regeneration.
3. **Evaluation pipeline:** TASK-0015 through TASK-0022 added provider routing, the multi-agent evaluation contract, orchestration, persistence, clarification, and review experience.
4. **Distribution and integrations:** TASK-0023 through TASK-0034 added provisioning planning/execution, retries, integration specifications, notifications, auth hardening, lifecycle, rate limiting, cost reporting, OAuth, and roster assignment.
5. **Discovery Engine:** `TASK-DISCOVERY-PHASE1` through `PHASE6` added the pre-intake discovery pipeline, manifest generation, API, and frontend.
6. **Production hardening:** TASK-0039 through TASK-0047 closed decisions, synchronized truth/config, deployed self-healing, added service tokens, fixed stale tests, and addressed security/correctness/performance findings.
7. **Discovery/live quality and real-provider fixes:** TASK-0048 through TASK-0066 added streaming, handoff fixes, model tiering, concurrency protection, schema/token fixes, taxonomy guards, and the current UI QoL plan.

Evidence: `git log --reverse --format='%h %ad %s' --date=short`, `docs/ai/BUILD_LOG.md`, `docs/ai/tasks/`, and `docs/product/`.

## Completed work by epic

### Epic 1 — Domain foundation and runtime (45 SP)

| Task | Work | SP |
|---|---|---:|
| TASK-0001 | Bootstrap domain core and canonical types | 8 |
| TASK-0002 | Iteration-2 MVP runtime and dry-run workflow | 8 |
| TASK-0003 | Dockerized NestJS API | 5 |
| TASK-0009 | API runtime and dependency stabilization | 3 |
| TASK-0010 | Minimal Next.js review UI | 8 |
| TASK-0011 | End-to-end runtime smoke and seeded demo data | 5 |
| TASK-0012 | Private server runtime deployment | 8 |
| **Epic total** | **Sum of leaf tasks** | **45** |

### Epic 2 — Intake workflow and human review (52 SP)

| Task | Work | SP |
|---|---|---:|
| TASK-0004 | R&D intake analysis module | 5 |
| TASK-0005 | Mock AI analysis draft module | 5 |
| TASK-0006 | Analysis review lifecycle | 8 |
| TASK-0007 | Require reviewed package before Gate 1 | 3 |
| TASK-0008 | Distribution preview from reviewed package | 5 |
| TASK-0014 | Guided AI draft regeneration | 5 |
| TASK-0014P | Intake review reject/regenerate loop | 5 |
| TASK-0021 | Web evaluation review experience | 8 |
| TASK-0022 | Clarification panel review fixes | 3 |
| TASK-0032 | Input validation hardening | 5 |
| **Epic total** | **Sum of leaf tasks** | **52** |

### Epic 3 — AI evaluation and governance (94 SP)

| Task | Work | SP |
|---|---|---:|
| TASK-0015 | AI provider router and adapters | 8 |
| TASK-0016 | Evaluation aggregate and agent contracts | 8 |
| TASK-0017 | Mock evaluation agents | 5 |
| TASK-0018 | Evaluation orchestrator | 8 |
| TASK-0018P | Orchestrator confidence-scale patch | 3 |
| TASK-0019 | Prisma evaluation persistence | 5 |
| TASK-0020 | Wire orchestrator into intake workflow | 13 |
| TASK-0030 | AI cost governance and usage reporting | 8 |
| TASK-0037 | Discovery Engine AI cost reporting | 5 |
| TASK-0036 | Provider config blank-environment fix | 3 |
| TASK-0056 | Per-agent model tiering | 5 |
| TASK-0059 | OpenAI strict-schema required fields | 5 |
| TASK-0061 | Discovery clarification re-blocking fix | 5 |
| TASK-0062 | Truncated manifest JSON and error classification | 5 |
| TASK-0063 | Evaluation failure recovery and token default | 5 |
| TASK-0064 | Bound custom-build output verbosity | 3 |
| TASK-0065 | Canonical project-type classifier taxonomy | 5 |
| **Epic total** | **Sum of leaf tasks** | **94** |

### Epic 4 — Discovery Engine and live interaction (108 SP)

| Task | Work | SP |
|---|---|---:|
| TASK-DISCOVERY-PHASE1 | Session, intent extraction, and problem framing | 8 |
| TASK-DISCOVERY-PHASE2 | Solution generation and clarification | 8 |
| TASK-DISCOVERY-PHASE3 | Proposal, completeness gate, and intake adapter | 8 |
| TASK-DISCOVERY-PHASE4 | Provisioning manifest generator | 8 |
| TASK-DISCOVERY-PHASE5 | NestJS DiscoveryModule and routes | 8 |
| TASK-DISCOVERY-PHASE6 | Discovery frontend UI | 13 |
| TASK-0046 | Prisma discovery-session store tests | 5 |
| TASK-0048 | Stream registry | 5 |
| TASK-0049 | SSE controller and auth | 5 |
| TASK-0050 | Real LLM streaming wiring | 5 |
| TASK-0051 | Frontend stream consumer | 8 |
| TASK-0052 | Caddy buffering and heartbeat | 3 |
| TASK-0053 | Initial-message solution-generation gap | 3 |
| TASK-0054 | Auto-artifacts and clarification drawer | 5 |
| TASK-0055 | Discovery-to-intake handoff fixes | 5 |
| TASK-0057 | Draft-ready race fix | 3 |
| TASK-0058 | Concurrency and duplicate-intake hardening | 8 |
| **Epic total** | **Sum of leaf tasks** | **106** |

`TASK-0066` is a plan, not completed work, so it is excluded from this total.

**Completed-work baseline:** 454 SP across the six epics above.

### Epic 5 — Distribution, integrations, and ownership (68 SP)

| Task | Work | SP |
|---|---|---:|
| TASK-0023 | Provisioning and integrations plan | 5 |
| TASK-0023A | Provisioning execution foundation and idempotency | 8 |
| TASK-0023B | Provisioning run UI | 5 |
| TASK-0023C | Failed-target retry | 5 |
| TASK-0023D | Monday adapter specification | 8 |
| TASK-0023E | GitHub adapter specification | 8 |
| TASK-0024 | Google Chat notifications | 3 |
| TASK-0025 | Email intake specification | 5 |
| TASK-0026 | Google Chat intake specification | 5 |
| TASK-0034 | Roster integration and assignment override | 8 |
| TASK-0038 | Monday schema verification | 5 |
| TASK-0060 | Distribution planner board/group correction | 3 |
| **Epic total** | **Sum of leaf tasks** | **68** |

### Epic 6 — Security, reliability, and operational hardening (82 SP)

| Task | Work | SP |
|---|---|---:|
| TASK-0027 | Auth hardening | 8 |
| TASK-0013 | Authenticated internal access and role resolution | 5 |
| TASK-0028 | Failure and recovery foundation | 8 |
| TASK-0029 | Rate limiting | 3 |
| TASK-0031 | Post-distribution lifecycle | 5 |
| TASK-0033 | Google OAuth activation | 8 |
| TASK-0039 | Open questions and decision pass | 8 |
| TASK-0040 | Hardening pass and truth sync | 8 |
| TASK-0041 | Production deploy and self-healing | 8 |
| TASK-0042 | Service-token authentication | 5 |
| TASK-0043 | Fix stale discovery tests | 3 |
| TASK-0044 | Service tokens provisioned | 3 |
| TASK-0045 | Monday adapter build plan | 5 |
| TASK-0047 | Security review fixes | 8 |
| **Epic total** | **Sum of leaf tasks** | **87** |

## Current backlog to size next

These are open GitHub findings, not completed tasks. They should be split or refined before sprint commitment.

| Issue(s) | Candidate epic | Work | Suggested SP |
|---|---|---|---:|
| #7, #8, #9, #10, #11, #12, #13, #15 | Security/reliability | Permission gaps, IDOR, unauthenticated intake, retry/error races, and duplicate provisioning | 13 each after splitting |
| #16 | Security/reliability | Remove or upgrade vulnerable multer dependency | 3 |
| #17, #18, #19 | Reliability | Align store error/reference/atomicity behavior | 5 each |
| #20, #22 | Integrations/accessibility | Team-prefix configuration and escaped Chat markup | 3 each |
| #21 | Accessibility | Labels for approval and Discovery chat inputs | 3 |
| #24, #25, #26, #27 | Performance | Pagination/indexing, AI-call parallelism, and N+1 writes | 5 each |

The `13` values above are a split warning, not permission to ship 13-point tasks whole. Re-estimate each child task after acceptance criteria are written.

## Not counted as completed

- TASK-0066 UI/intake QoL plan: planning only.
- Live Monday/GitHub write adapters: the project memory says these remain spec-ready/mock-only; do not count the adapter specs as live integration delivery.
- Historical task documents without a matching implementation commit: retained as planning context, not silently promoted to done.

## References

- Product hierarchy: `docs/product/product-overview.md`, `docs/product/distribution-rules.md`
- Workflow and approval rules: `docs/product/workflow-state-machine.md`, `docs/product/permissions-and-ownership.md`
- AI scope: `docs/product/ai-orchestration.md`, `docs/product/ai-cost-governance.md`
- Durable history: `docs/ai/BUILD_LOG.md`, `docs/ai/tasks/`, `docs/ai/PROJECT_MEMORY.md`
