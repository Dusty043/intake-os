# Monday Mapping

## Purpose

This document captures the mapping required before the OS can safely create Monday items.

Live Monday writes are blocked until this mapping is completed for the target board.

## Required Board Information

- board ID
- workspace ID if needed
- group IDs
- item naming convention
- required columns
- status labels
- people column behavior
- story point/effort column type
- link column for OS record
- link column for GitHub repo
- subitem support and subitem board columns

## Proposed Field Mapping

| OS Field | Monday Target | Status |
| --- | --- | --- |
| approved project title | item name | open |
| project type | status/dropdown column | open |
| complexity bucket | status/dropdown column | open |
| estimated story points | numbers column | open |
| assigned developer | people column | open |
| requester | text/person column | open |
| approved brief summary | long text/update | open |
| OS intake URL | link column | open |
| GitHub repo URL | link column | open |
| subtasks | subitems | open |

## Creation Strategy

Start with preview-only output. Then create one parent item. Add subitems only after the subitem schema is confirmed.

## Safety Rules

- Retrieve board/group/column configuration before first live creation.
- Store Monday item ID and URL after creation.
- Use idempotency key per item/subitem.
- Never create duplicate items on retry.
- Avoid creating new status/dropdown labels automatically in v1 unless explicitly approved.

## Source Verification Snapshot

Monday's create-item guidance requires correct board/group/column IDs and type-specific column value formats before creating items on an unfamiliar board: https://developer.monday.com/api-reference/docs/create-item
