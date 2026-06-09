# Decisions Summary

| ADR | Decision | Status | Notes |
|---|---|---|---|
| ADR-0001 | Start with a framework-neutral TypeScript domain core before UI/database/integrations | accepted | Keeps product rules testable and portable while the monolith shape is finalized. |
| ADR-0002 | Use a portable NestJS-ready runtime around the framework-neutral core | accepted | Keeps core verifiable while enabling HTTP/Prisma runtime. |
| ADR-0003 | Keep orchestration OS-owned and exclude n8n as runtime/plumbing | accepted | Native adapters will handle sources; OS owns state, retries, audit, and integration behavior. |
