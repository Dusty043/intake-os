# ADR-0002 — Portable NestJS-Ready Runtime Before Cloud Commitment

## Status

Accepted for Iteration 2.

## Context

The project needs to become a usable MVP/POC without prematurely committing to Vercel-only hosting or deep AWS infrastructure. The likely backend shape is NestJS, but the current environment cannot fetch third-party npm packages during this build pass.

## Decision

Build a dependency-free, framework-neutral application service layer and place it behind a NestJS-ready `apps/api` structure. Add Docker/Postgres deployment scaffolding now, but keep the verified code path local and portable.

## Consequences

- The domain and application services can be tested without external packages.
- Real NestJS controllers/providers can be added later without rewriting core workflow logic.
- The app remains portable across local Docker, simple container hosting, and AWS/ECS later.
- The current API folder is a composition/controller shell, not a live HTTP server yet.
