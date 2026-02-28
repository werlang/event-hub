# Agent Backlog

This file is the **single source of truth** for TODOs in this repository.

Use this file for both triage and execution tracking.

## Why this format

Industry standard is to track work in an issue tracker (GitHub Issues/Jira) and keep each task:

- Atomic (one focused outcome)
- Prioritized
- Testable (clear acceptance criteria)
- Linked to source/context

For this repository, this markdown backlog complements that model and is optimized for AI agents to execute tasks directly.

## Workflow

1. Add new TODOs using the template below.
2. Keep status updated (`todo`, `in-progress`, `blocked`, `done`).
3. Use acceptance criteria as the completion contract.
4. For large features, add a concise design note in this file, then track implementation steps here.

## Inbox Entry Template

```markdown
## [TODO-XXXX] Short imperative title
- Status: todo | in-progress | blocked | done
- Priority: P0 | P1 | P2 | P3
- Type: bug | feature | tech-debt | refactor | docs | ops
- Scope: web | api | shared | infra
- Source: path/to/file.js#Lx-Ly (or issue/PR link)
- Dependencies: none | TODO-YYYY, TODO-ZZZZ

### Context
One short paragraph with problem statement and current behavior.

### Acceptance Criteria
- [ ] Observable outcome 1
- [ ] Observable outcome 2
- [ ] Validation step (manual or automated)
```

## Active TODOs

## [TODO-EVHUB-STYLE-ALIGN-01] Align API primitives and app pipeline
- Status: done
- Priority: P1
- Type: refactor
- Scope: api
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-01-api-primitives.md
- Dependencies: none

### Context
Introduce centralized API response/error primitives and align `api/app.js` boot pipeline to include readiness, explicit 404 handling, and terminal error middleware.

### Acceptance Criteria
- [x] Centralized error middleware exists and is wired in `api/app.js`
- [x] Success response helper exists for envelope consistency
- [x] Readiness and explicit 404 handling are present
- [x] No route-specific ad-hoc error response format introduced
- [x] Manual validation completed
