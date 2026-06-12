# TASK-0016: Domain Foundation — Evaluation Aggregate & Agent Contracts

## Status

**COMPLETE**

## Objective

Establish the pure domain types, validation logic, agent contract interfaces, and bidirectional mapper that the 12-agent evaluation pipeline (Option A) will be built on. No behavior change to existing intake analysis draft generation; no Prisma, no API routes, no UI.

## Files Created

| File | Purpose |
|------|---------|
| `src/application/intake-evaluation.ts` | All 12 section content interfaces, `IntakeEvaluation` aggregate, `EvaluationSection<TContent>`, quality score types, depth routing table, validators |
| `src/application/agents/agent-contract.ts` | `AgentRunContext`, `AgentRunOptions`, `AgentOutput<TContent>`, `EvaluationAgent<TContent>` interface |
| `src/application/evaluation-draft-mapper.ts` | `evaluationToLegacyDraft()` and `legacyDraftToEvaluation()` bidirectional mapper |
| `tests/intake-evaluation-domain.test.mjs` | 31 tests for section kinds, depth routing, quality band, section helpers, validators |
| `tests/evaluation-agent-contract.test.mjs` | 15 tests for AgentRunContext, AgentRunOptions, AgentOutput, and EvaluationAgent interface contract |
| `tests/evaluation-draft-mapper.test.mjs` | 30 tests for evaluationToLegacyDraft, legacyDraftToEvaluation, and round-trip |

## Files Modified

| File | Change |
|------|--------|
| `src/index.ts` | Added exports for `intake-evaluation.js`, `evaluation-draft-mapper.js`, `agents/agent-contract.js` |
| `src/application/intake-evaluation.ts` | Fixed TypeScript cast: `section.content as Record<string,unknown>` → `as unknown as Record<string,unknown>` |

## Key Design Decisions

### Section Kinds (12 total)
```
intake_brief, clarification_questions, classification,
architecture, low_code_path, custom_build,
risk_security, cost_effort, work_breakdown, distribution_plan,
synthesis, quality_review
```

### Depth Routing
- `light`: 5 sections (intake_brief, classification, work_breakdown, synthesis, quality_review)
- `standard`: 10 sections (adds clarification, architecture, risk_security, cost_effort, distribution_plan)
- `full`: 12 sections (standard + low_code_path, custom_build)

### Quality Score
- 6 dimensions: completeness, consistency, specificity, feasibility, riskCoverage, handoffReadiness
- `readinessBand`: ready (≥90), usable (≥70), needs_revision (≥50), not_ready (<50)
- `validateEvaluationSection` enforces `readinessBand` is consistent with `overall` score

### Bidirectional Mapper
- `evaluationToLegacyDraft`: projects evaluation sections to `IntakeAnalysisDraft` for backward compat with existing API/UI
- `legacyDraftToEvaluation`: produces 6 minimum sections (intake_brief, work_breakdown, risk_security, cost_effort, synthesis, quality_review) from legacy drafts
- Neither function mutates inputs

### AgentRunContext / AgentOutput
- `sections: Partial<Record<EvaluationSectionKind, EvaluationSection>>` — accumulates results during pipeline run
- `AgentOutput.isClarificationBlocking` — signals that pipeline must pause before Stage 2
- All AI governance fields (id, status, actor, timestamps) are set externally; agents never set them

## Constraints Honored

- No live AI calls made in this task
- No Prisma schema changes
- No workflow state or approval logic touched
- No API routes or frontend UI added
- Existing `IntakeAnalysisDraft` format fully preserved

## Tests

205/205 passing (`npm test`)  
`npm run build` clean  
`npm run api:build` clean  
`npm run web:build` clean  

## Follow-up: TASK-0017

Implement the 12 mock evaluation agents in `src/application/agents/mock/`.
