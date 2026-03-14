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
- `Implementation notes` (module boundaries, abstractions to preserve, refactor constraints)
- `Design-note` references (when available)

## Status definitions

- `todo`: ready to start
- `in-progress`: currently being executed
- `blocked`: waiting on decision or dependency
- `done`: acceptance criteria validated

## Engineering standards

Every task should be written and implemented with these defaults:

- Preserve clear module boundaries and single responsibility.
- Prefer extracting collaborators over enlarging bloated files or classes.
- Keep class-focused modules class-focused; move reusable standalone helpers into dedicated modules when they stop being local implementation detail.
- Treat readability, maintainability, and scalability as part of the completion bar, not as optional cleanup.

## Task quality checklist

Before marking a task ready:

- Is the outcome observable?
- Are acceptance criteria testable?
- Is scope small enough for one focused implementation session?
- Are dependencies explicit?
- Are responsibility boundaries explicit enough to prevent adding more code to an already bloated module or class?
- Does the definition of done imply maintainable, easy-to-understand code aligned with project standards?

If any answer is “no”, refine the task before execution.

## Template

- Use the entry template inside `tasks/backlog.md`.

## Relationship with backlog

- For small/operational work, backlog entries are enough.
- For larger features, add a scoped design note directly in `backlog.md`, then track implementation TODOs there.
