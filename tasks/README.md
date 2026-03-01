# Tasks

This directory is the execution layer for work done by humans and AI agents.

## Canonical workflow (single-file backlog)

There is **one source of truth**: `backlog.md`.

All TODOs (triage + execution) live in that file.

If you remember only one rule: **never create one-file-per-task documents in `tasks/`**.

## Why this model

- Keeps writing friction low (quick capture and update in one place).
- Avoids file sprawl for small/medium work.
- Keeps agent context centralized and easy to scan.

## Entry identifier convention

Use incremental IDs inside `backlog.md`, e.g.:

- `[TODO-0001]`
- `[TODO-0002]`
- `[TODO-0003]`

## Required fields (minimum contract)

Every TODO entry in `backlog.md` must include:

- `Status`
- `Priority`
- `Type`
- `Scope`
- `Source`
- `Dependencies` (optional if none)
- `Context`
- `Acceptance Criteria` (checklist)

These are the minimum fields agents need to execute with low ambiguity.

## Recommended optional fields

- `Out of scope` (to prevent scope creep)
- `Validation` (how to verify done)
- `Design-note` references (when available)

## Status definitions

- `todo`: ready to start
- `in-progress`: currently being executed
- `blocked`: waiting on decision or dependency
- `done`: acceptance criteria validated

## Task quality checklist

Before marking a task ready:

- Is the outcome observable?
- Are acceptance criteria testable?
- Is scope small enough for one focused implementation session?
- Are dependencies explicit?

If any answer is “no”, refine the task before execution.

## Template

- Use the entry template inside `tasks/backlog.md`.

## Relationship with backlog

- For small/operational work, backlog entries are enough.
- For larger features, add a scoped design note directly in `backlog.md`, then track implementation TODOs there.
