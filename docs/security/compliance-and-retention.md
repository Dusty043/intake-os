# Compliance and Retention

## Principle

The Project Intake OS should collect and retain the minimum data needed to analyze, govern, and distribute project work.

## Default Retention Posture

For MVP:

- Store normalized intake text and structured outputs only if needed for review/audit.
- Avoid storing attachments until security rules are defined.
- Store raw source payloads only behind an explicit retention flag.
- Redact obvious secrets from logs.
- Do not log AI prompts/responses in application logs.
- Store AI usage metadata separately from raw content.

## Sensitive Data Rule

If project inquiries may include PHI, regulated healthcare data, client secrets, credentials, or sensitive personal data, external AI processing must be blocked until the provider path is approved.

## AI Provider Requirements

Before processing PHI or regulated client data through an AI provider, confirm:

- BAA availability and coverage
- data retention controls
- whether prompts/responses are used for training
- zero-data-retention eligibility if required
- regional/data residency needs
- logging behavior
- excluded features under BAA terms

## Audit Events

Audit events should include:

- actor
- action
- intake ID
- from/to state where applicable
- timestamp
- safe metadata

Avoid placing raw inquiry text, secrets, credentials, or full AI prompts into audit metadata.

## Logging Rules

- Log request IDs, not full body content.
- Redact API tokens and secrets.
- Avoid logging raw source payloads from email/chat/webhooks.
- Separate operational logs from audit records.

## Source Verification Snapshot

- OpenAI says API data is not used to train by default unless explicitly opted in, and abuse monitoring logs may be retained up to 30 days by default: https://platform.openai.com/docs/guides/your-data
- OpenAI requires a BAA before using API services with PHI: https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai
- Anthropic describes BAA availability for eligible API/commercial use cases with configuration limitations: https://support.anthropic.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers
- AWS lists Amazon Bedrock among HIPAA eligible services, subject to correct configuration and the shared responsibility model: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/
