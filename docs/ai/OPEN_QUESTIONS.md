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
