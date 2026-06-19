# Open Questions

| ID | Question | Owner | Status | Notes |
|---|---|---|---|---|
| Q-0001 | Should `docs/product/distribution-rules.md` be recreated from the appendices before distribution package implementation? | Product/Admin | open | The file is referenced but missing from the uploaded repo. |
| Q-0002 | What are the approved team prefixes for repository naming? | DevOps/Admin | open | Current helper supports `ds`, `ops`, `client`, and `internal` examples only. |
| Q-0003 | Which GitHub org should live repos be created under? | DevOps/Admin | open | Required before live GitHub provisioning. |
| Q-0004 | Should GitHub repositories be private by default? | DevOps/Admin | open | Likely yes for internal work, but not confirmed. |
| Q-0005 | Which Monday board/group/column schema should provisioning target? | DevOps/Admin | open | Required before live Monday payload generation. |
| Q-0006 | Which app framework should wrap the domain core? | Engineering | open | Domain code is framework-neutral for now; likely monolith remains preferred. |
| Q-0007 | Which inbound email service for TASK-0025? (postmark/cloudmailin/mailgun/sendgrid) | DevOps/Admin | open | Needed before email intake endpoint can be implemented. |
| Q-0008 | What email address will users send project intakes to? | Admin | open | Required for TASK-0025. E.g. `intake@simple.biz`. |
| Q-0009 | Does Simple.biz have a Google Cloud project for TASK-0026? | Admin | open | Needed for Google Chat app setup. |
| Q-0010 | Does Simple.biz have a Google Workspace admin? | Admin | open | Required to install Google Chat app domain-wide (TASK-0026). |
| Q-AUTH-1 | When Google Auth goes live, what `GOOGLE_CLIENT_ID` will be used? | Admin | open | Required for TASK-0027. |
| Q-AUTH-2 | Should missing `AUTH_SESSION_COOKIE_NAME` also fail at startup when `AUTH_MODE=google`? | Engineering | open | TASK-0027. |
| Q-FAR-1 | Should `maxAttempts` be configurable per target kind (Monday vs GitHub)? | Engineering | open | TASK-0028. |
| Q-FAR-2 | Should dead-letter promotion send a Google Chat notification? | Product | open | TASK-0028. |
| Q-FAR-3 | Should backoff sleep be synchronous (v1) or scheduled as a future job (v2)? | Engineering | open | TASK-0028. |
| Q-RL-1 | Is the server behind nginx? Does nginx already rate-limit? | DevOps | open | TASK-0029. |
| Q-RL-2 | Should authenticated users get a higher rate limit than unauthenticated? | Product | open | TASK-0029. |
| Q-COST-1 | Which AI models are currently in use in production evaluations? | Engineering | open | TASK-0030. |
| Q-COST-2 | Should cost estimates be shown to non-admin users (Intake Owners)? | Product | open | TASK-0030. |
| Q-LIFE-001 | Who can mark a distributed project completed — DevOps Lead only, or also Intake Owner? | Admin | open | TASK-0031. |
| Q-LIFE-002 | Should `canceled` after distribution trigger a Chat notification? | Product | open | TASK-0031. |
| Q-VAL-1 | Should `forbidNonWhitelisted: true` be enabled globally on the ValidationPipe? | Engineering | open | TASK-0032. |
| Q-VAL-2 | Should description have a minimum useful length (e.g. 20 chars)? | Product | open | TASK-0032. |
