# ADR-0001: Domain-First Monolith Foundation

## Status

Accepted

## Context

The uploaded repository contained product/build documentation but no application code. The product specs describe workflow, approval, provisioning, project type, permission, and repository naming rules that must remain deterministic and testable.

The user previously indicated a preference for a custom in-house monolith where Monday and GitHub act as distribution networks rather than sources of truth.

## Decision

Start implementation with a framework-neutral TypeScript domain core before adding UI, database persistence, background workers, or live integrations.

## Rationale

- Keeps product rules testable without requiring database or API scaffolding first.
- Allows a future monolith framework to consume one source of domain truth.
- Reduces risk of scattering approval and provisioning guards across UI routes or integration clients.
- Avoids inventing live Monday/GitHub behavior while `docs/product/distribution-rules.md` is missing.

## Consequences

Positive:

- Fast automated checks are available immediately.
- Future persistence/API layers can wrap already-tested domain logic.
- Approval and provisioning guards are visible and reviewable.

Trade-offs:

- There is not yet a runnable web app.
- Persistence, authentication, background jobs, and integrations remain unimplemented.
- Framework choice is still open.
