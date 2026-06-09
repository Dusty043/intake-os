# Project Memory

## Current System State

The repository began as a product/specification package. TASK-0001 added the first implementation foundation as framework-neutral TypeScript domain code.

Implemented foundation areas:

- workflow status and transition definitions
- approval gate guards and immutable approval records
- provisioning readiness guard requiring approved state, Gate 1, Gate 2, and validated distribution package
- role permission helpers
- canonical project type registry defaults
- GitHub requirement resolution helper
- evaluation depth section helper
- repository slug/name validation, collision detection, default labels, and README generation

No database, UI, queue worker, authentication provider, live AI provider, Monday integration, or GitHub integration has been implemented yet.

## Architecture Direction

The current implementation is intentionally domain-first and framework-neutral so a monolith can add persistence, API routes, workers, and UI without duplicating product logic.

## Product Principle

The app owns the boundary. Monday and GitHub distribute the work. Developers own implementation.
