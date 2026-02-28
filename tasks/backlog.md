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

## [TODO-EVHUB-STYLE-ALIGN-02] Refactor API model/driver architecture
- Status: done
- Priority: P1
- Type: refactor
- Scope: api
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-02-model-driver-refactor.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-01

### Context
Introduce a shared base model abstraction for UUID-based entities, move generic persistence operations to model primitives backed by `api/helpers/mysql.js`, and keep `api/helpers/datastore.js` focused on bootstrap/seed orchestration.

### Acceptance Criteria
- [x] Shared base model abstraction exists and is used by domain models
- [x] UUID strategy remains intact for users/events
- [x] SQL statements are not authored in route/model orchestration layers
- [x] Existing core data flows still function
- [x] Manual validation completed

## [TODO-EVHUB-STYLE-ALIGN-03] Model event audience via relation + migrate legacy data
- Status: done
- Priority: P1
- Type: feature
- Scope: api
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-03-audience-relation-migration.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-02

### Context
Replace JSON-backed event audience persistence with relation-backed rows while preserving API response contract `audience: string[]`.

### Acceptance Criteria
- [x] Audience data is persisted via relation table semantics
- [x] Legacy audience data migration is idempotent
- [x] API consumers still receive audience arrays
- [x] Duplicate relation insertion is prevented
- [x] Manual validation completed

## [TODO-EVHUB-STYLE-ALIGN-04] Refactor route/auth envelope contract and harden JWT config
- Status: done
- Priority: P1
- Type: refactor
- Scope: api
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-04-routes-auth-envelope.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-01, TODO-EVHUB-STYLE-ALIGN-02, TODO-EVHUB-STYLE-ALIGN-03

### Context
Align auth and events routes with sample-style `try/catch` + `next(error)` control flow, ensure fully consistent response envelopes, and enforce production-safe JWT secret requirements without changing existing route paths or JWT-only auth behavior.

### Acceptance Criteria
- [x] Route handlers use centralized error pipeline (no ad-hoc catch responses)
- [x] JWT-only auth remains in place
- [x] Production token configuration enforces secret policy
- [x] All affected endpoints return consistent success envelope
- [x] Manual validation completed

## [TODO-EVHUB-STYLE-ALIGN-05] Align web client with standardized API envelope
- Status: done
- Priority: P1
- Type: feature
- Scope: web
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-05-web-contract-alignment.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-04

### Context
Adapt frontend API integration to parse the standardized success/error envelope while preserving existing auth and event listing/publish/filter user flows.

### Acceptance Criteria
- [x] No frontend runtime errors caused by API contract changes
- [x] Auth flows still work end-to-end
- [x] Event listing/filtering/publishing still work end-to-end
- [x] Envelope errors are surfaced cleanly in UI
- [x] Manual validation completed

## [TODO-EVHUB-STYLE-ALIGN-06] Audit and realign documentation context
- Status: done
- Priority: P1
- Type: docs
- Scope: shared
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-06-docs-audit.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-05

### Context
Run the documentation audit prompt and align `.github` instructions/skills/prompts with the actual API/Web/Compose implementation, removing stale claims and updating contracts/security/build notes.

### Acceptance Criteria
- [x] `.github` docs align with current implementation
- [x] No stale references to non-existent systems remain
- [x] Skills and prompts are actionable for future agents
- [x] Audit summary is produced
- [x] Manual review completed

## [TODO-EVHUB-STYLE-ALIGN-07] Final wrap-up and delivery artifacts
- Status: todo
- Priority: P1
- Type: docs
- Scope: shared
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-07-release-artifacts.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-06

### Context
Produce final release artifacts (`04-commit-msg.md`, `05-gitlab-mr.md`) and compile the delivery summary after all implementation and documentation tasks are complete.

### Acceptance Criteria
- [ ] Final artifact files are created and coherent with delivered implementation
- [ ] Progress trackers reflect final state
- [ ] Delivery summary includes validations and known residual risks
