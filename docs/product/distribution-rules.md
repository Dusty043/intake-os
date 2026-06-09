# Distribution Rules

## Principle

The Project Intake OS is the pre-distribution source of truth. Monday and GitHub are downstream execution destinations.

Distribution happens only after:

1. Intake is reviewed.
2. Required approval gates are complete.
3. Distribution preview is generated.
4. A human approves downstream creation.

AI-generated content alone must never trigger live downstream writes.

## What Stays in the OS

- raw or normalized intake source data, subject to retention policy
- AI analysis drafts and versions
- human-edited approved brief
- approval history
- audit trail
- distribution preview
- external resource IDs and URLs
- idempotency keys
- compliance flags
- assignment recommendation history

## What Goes to Monday

Monday should receive management-visible delivery tracking:

- project title
- approved brief summary
- project type
- requester/client/internal owner
- priority/status
- story point estimate or complexity bucket
- assigned developer/owner if available
- subtasks or subitems when mapping is confirmed
- link back to Project Intake OS record
- GitHub repo link after repo creation

Do not mirror every OS field into Monday.

## What Goes to GitHub

GitHub should receive engineering execution assets:

- repository if required
- README/project brief
- labels
- initial issues
- task breakdown
- acceptance criteria
- link back to Project Intake OS record
- Monday project/item link if created

## Distribution Modes

| Mode | Meaning |
| --- | --- |
| none | No downstream creation. Keep in OS only. |
| monday_only | Create Monday tracking item/subitems only. |
| github_only | Create GitHub repo/issues only. |
| monday_and_github | Create both Monday and GitHub assets. |
| preview_only | Generate preview but block live execution. |

## Idempotency Rules

Every downstream action must have an idempotency key.

Examples:

- `intake:{id}:github:repo:{repoName}`
- `intake:{id}:github:issue:{slug}`
- `intake:{id}:monday:item:{boardId}:{itemName}`

Retry behavior:

- If an external resource exists and is recorded, reuse it.
- If Monday succeeds and GitHub fails, retry GitHub only.
- If GitHub succeeds and Monday fails, retry Monday only.
- Never create duplicate repos, items, or issues on retry.

## Failure Rules

- Partial failures must create audit events.
- Failed steps should be visible in the OS.
- Users should be able to retry failed steps after reviewing the preview and existing external resources.
- Automatic deletion of downstream resources should be avoided in v1.
