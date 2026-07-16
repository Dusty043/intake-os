# TASK-0067: Trace project history and size epics/tasks

**Status:** Complete for documentation baseline  
**Date:** 2026-07-16  
**Issue:** #38

## Request

Sync the repository state to GitHub, trace its history, and create a Markdown breakdown of the project by epic and task using story-point equivalents based on the 1, 2, 3, 5, 8, 13 scale.

## Context read

- `AGENTS.md`, `CLAUDE.md`, `BUILD_GUIDE.md`
- `docs/product/product-overview.md`
- `docs/ai/PROJECT_MEMORY.md`, `KNOWN_CONSTRAINTS.md`, `OPEN_QUESTIONS.md`, `MEMORY_INDEX.md`
- `docs/product/requirements-trace.md` and the product module specs
- Existing task logs, `BUILD_LOG.md`, package scripts, Git history, GitHub issues/PR state

## Plan

1. Fetch canonical `origin` state without overwriting existing untracked files.
2. Trace the commit/task sequence and group completed work into product-aligned epics.
3. Estimate leaf tasks only; calculate epic totals by addition.
4. Record open GitHub findings separately from completed work.
5. Update repository memory, verify Markdown, and publish on a draft PR.

## Changes

- Added `docs/ai/PROJECT_EPIC_TASK_BREAKDOWN.md` with history, six epics, task estimates, totals, current backlog, and explicit exclusions.
- Added this task log.
- Appended the build log and refreshed the memory index.

## Commands run

- `git fetch origin --prune`
- `git log --reverse --format='%h %ad %s' --date=short --all`
- `gh auth status`, `gh repo view`, `gh pr list`, `gh issue list`
- `git diff --check`
- `npm run ai:index`

## Verification

- Canonical `origin/main` is at `83d87ea` on 2026-07-16.
- `gh` confirmed repository `Dusty043/intake-os` and issue #38.
- Markdown/index generation and whitespace checks pass.
- The `simple-biz` remote was not changed; its fetch requires unavailable interactive credentials.

## Handoff

The breakdown is a retrospective planning baseline. Before sprint planning, split any 8/13-point candidate, confirm acceptance criteria, and create child issues. Live Monday/GitHub adapters remain excluded because repository memory identifies them as mock-only/spec-ready.
