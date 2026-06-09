# Feasibility Analysis — Project Intake OS R&D

## Summary

The project is technically feasible. The primary risks are not basic application development; they are data quality, integration mapping, approval safety, AI output quality, and compliance posture.

## Feasibility Rating

| Area | Rating | Notes |
| --- | --- | --- |
| Core workflow app | High | Current repo already implements no-AI workflow spine and tests. |
| NestJS/Postgres API | Medium-high | Source exists; dependency-backed runtime still needs install/build/smoke verification. |
| AI analysis | Medium | Structured output makes this feasible, but output quality needs historical evaluation. |
| Monday creation | Medium | Feasible after target board columns/groups/statuses are mapped. |
| GitHub provisioning | Medium | Feasible after org/app permissions, naming, visibility, and retry rules are confirmed. |
| Developer assignment | Medium | Depends on roster API richness and workload signal availability. |
| Google Chat intake | Medium-low for MVP | Incoming webhooks are outbound-only; interactive intake requires a proper Chat app. |
| Compliance | Unknown | Depends on whether raw project inquiry text contains PHI or regulated client data. |

## Complexity Estimate

| Scope | Estimate |
| --- | --- |
| R&D artifact completion | 8-13 SP |
| Analysis-only AI prototype | 13-21 SP |
| OS MVP with review UI and preview | 34-55 SP |
| Live Monday + GitHub provisioning | 34-55 SP additional |
| Full multi-source intake + assignment + compliance hardening | 55-89 SP additional |

## Technical Risks

1. Historical Monday data may be inconsistent or hard to access.
2. Story point estimates may not map cleanly to project types without examples.
3. Roster API may not expose current workload or project history.
4. Monday board schemas may be customized and brittle.
5. GitHub org permissions may block app-based provisioning.
6. AI output may be plausible but miscalibrated without evaluation data.
7. PHI/client-sensitive content may require provider/legal setup before live testing.

## Recommended Mitigations

- Use mock providers before live providers.
- Store AI outputs as draft records, not final decisions.
- Require human review before distribution.
- Build distribution preview before live writes.
- Keep idempotency keys on every downstream action.
- Start with one target Monday board and one GitHub org.
- Use a small historical evaluation set before model selection.
