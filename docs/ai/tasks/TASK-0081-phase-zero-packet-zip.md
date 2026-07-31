# TASK-0081 — Phase 0 packet and ZIP export

**Status:** Complete
**GitHub:** https://github.com/Dusty043/intake-os/issues/43

## Request

Generate, validate, preview, persist, and download the complete static Phase 0 document tree.

## Plan

1. Define server-owned document paths and packet contracts.
2. Compose every required document from Discovery and evaluation evidence.
3. Validate content, assumptions, hashes, diagrams, and quality warnings.
4. Add owner-scoped preview and ZIP endpoints.

## Handoff

Implemented the complete server-owned 00-10 document tree, deterministic escaped
SVG wireframes, portable Mermaid diagrams, actionable Figma handoff, evidence and
assumption annotations, critic warnings, one repair pass, SHA-256 metadata, JSON
manifest, preview metadata, and owner-scoped in-memory `fflate` ZIP download.
Models never control filenames and invalid or empty required files fail the run.

## Verification

- Packet and HTTP boundary tests are included in the 810-test core suite.
- `npm run test:api`: 10 passed.
- ZIP contents, path validation, N/A rationale, SVG escaping, idempotency,
  ownership isolation, and warning behavior are covered.

## Follow-up

Live Figma files and stored ZIP binaries are deliberately excluded.
