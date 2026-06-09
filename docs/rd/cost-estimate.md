# Cost Estimate — Project Intake OS R&D

## Assumptions

A typical intake analysis may use:

- 3,000-8,000 input tokens for the inquiry, schema instructions, team/project context, and examples.
- 1,000-3,000 output tokens for structured analysis, tasks, missing information, and brief text.
- Optional second-pass model call for review or cost/complexity validation.

## AI API Cost Range

At low to moderate intake volume, AI API cost is expected to be small compared with development time.

Example rough cost per intake:

| Model tier | Estimated per-intake range |
| --- | --- |
| Low-cost classifier/drafter | Less than $0.01-$0.03 |
| Mid-tier analysis model | Around $0.03-$0.15 |
| Strong model with multi-pass review | Around $0.15-$0.75 |

Exact cost must be calculated from actual token usage and selected provider pricing at implementation time.

## Infrastructure Cost Range

For MVP/local-first:

| Component | Expected cost |
| --- | --- |
| Local Docker dev | $0 cloud spend |
| Postgres local | $0 cloud spend |
| Hosted small API + DB staging | Low monthly cost, provider-dependent |
| Queue/cache | Defer until needed |
| File storage | Defer unless attachments become in-scope |

## Development Investment

| Phase | Estimate |
| --- | --- |
| R&D and historical data study | 1-2 weeks |
| AI analysis prototype | 1 sprint |
| Review UI + workflow MVP | 1-2 sprints |
| Live Monday/GitHub integration | 1-2 sprints |
| Compliance hardening and rollout | depends on requirements |

## Cost Controls

- Use low-cost model for classification and extraction.
- Use stronger model only when complexity or confidence requires it.
- Cache reusable project taxonomy, roster context, and Monday mapping context.
- Track tokens, model, latency, estimated cost, and result status per AI run.
- Limit regenerations per intake.
- Require admin override for expensive full-analysis runs.

## Source Verification Snapshot

- OpenAI API pricing: https://openai.com/api/pricing/
- Anthropic model pricing: https://docs.anthropic.com/en/docs/about-claude/pricing
- OpenAI data controls: https://platform.openai.com/docs/guides/your-data
- OpenAI API BAA guidance: https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai
- Anthropic BAA guidance: https://support.anthropic.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers
- AWS HIPAA eligible services reference: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/
