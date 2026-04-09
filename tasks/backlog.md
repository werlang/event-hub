# Agent Backlog

This file is the **single source of truth** for TODOs in this repository.

Use this file for both triage and execution tracking.

## Why this format

Industry standard is to track work in an issue tracker (GitHub Issues/Jira) and keep each task:

- Atomic (one focused outcome)
- Prioritized
- Testable (clear acceptance criteria)
- Maintainable (clear module boundaries and sustainable implementation direction)
- Linked to source/context

For this repository, this markdown backlog complements that model and is optimized for AI agents to execute tasks directly.

## Workflow

1. Add new TODOs using the template below.
2. Keep status updated (`todo`, `in-progress`, `blocked`, `done`).
3. Use acceptance criteria as the completion contract.
4. For large features, add a concise design note in this file, then track implementation steps here.

## Engineering standard for all TODOs

- Preserve or improve readability, maintainability, and scalability.
- Prefer extracting focused collaborators when a file, class, or entrypoint is already carrying multiple concerns.
- Keep class-oriented files centered on their class contract; reusable standalone helpers belong in companion modules.
- Do not treat structural quality as optional polish. It is part of the task definition of done.

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

### Implementation Notes
Optional engineering constraints such as module boundaries, abstractions to preserve, or refactor direction.

### Acceptance Criteria
- [ ] Observable outcome 1
- [ ] Observable outcome 2
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)
```

## Active TODOs

## [TODO-0001] Turn dashboard command area into accessible tabs
- Status: done
- Priority: P1
- Type: feature
- Scope: web
- Source: tasks/TODOs.md#L11
- Dependencies: none

### Context
The dashboard command area needed a clearer subheader-style interaction: the current events view should stay as the active dashboard surface, while the other horizontal tabs should perform direct actions for creating a new event and opening account settings.

### Implementation Notes
Keep the page content below intact and use a horizontal subheader-style tab row in the command area. The current-view tab should keep the dashboard/events content in focus, while the create and settings tabs should open their modals directly.

### Acceptance Criteria
- [x] The top dashboard command area exposes viewing, creation, and settings through a horizontal subheader-style tab row
- [x] Clicking the current-view tab focuses the dashboard/events content directly
- [x] Clicking the new-event tab opens the create-event modal directly
- [x] Clicking the settings tab opens the settings modal directly
- [x] Existing create, edit, delete, and settings flows still work from the dashboard
- [x] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [x] Validation completed by rebuilding the web bundle

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
Introduce a shared base model abstraction for UUID-based entities, move generic persistence operations to model primitives backed by `api/helpers/mysql.js`, and keep `api/helpers/bootstrap.js` focused on schema/seed orchestration.

### Acceptance Criteria
- [x] Shared base model abstraction exists and is used by domain models
- [x] UUID strategy remains intact for users/events
- [x] SQL statements are not authored in route/model orchestration layers
- [x] Existing core data flows still function
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
- Status: done
- Priority: P1
- Type: docs
- Scope: shared
- Source: .agents/changes/EVHUB-STYLE-ALIGN-api-sample-mirroring/03-tasks-07-release-artifacts.md
- Dependencies: TODO-EVHUB-STYLE-ALIGN-06

### Context
Produce final release artifacts (`04-commit-msg.md`, `05-gitlab-mr.md`) and compile the delivery summary after all implementation and documentation tasks are complete.

### Acceptance Criteria
- [x] Final artifact files are created and coherent with delivered implementation
- [x] Progress trackers reflect final state
- [x] Delivery summary includes validations and known residual risks

## [TODO-0002] Default index search to the next seven days
- Status: todo
- Priority: P1
- Type: feature
- Scope: web
- Source: tasks/TODOs.md#L11
- Dependencies: none

### Context
The home event search should start with a `Proximos 7 dias` style date window so users see imminent events without having to configure the filters manually.

### Implementation Notes
Keep the default coherent across the SSR shell, query-state hydration, and client-side filtering so shared URLs and refreshes behave predictably.

### Acceptance Criteria
- [ ] The home page loads with the next-seven-days filter applied by default
- [ ] User-selected filters and shared query-string state still hydrate correctly after the default is introduced
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0003] Align index filters with dashboard filter patterns
- Status: todo
- Priority: P1
- Type: refactor
- Scope: web
- Source: tasks/TODOs.md#L12
- Dependencies: TODO-0002

### Context
The index filter section should be brought closer to the dashboard filter treatment so the application presents a more consistent filtering experience.

### Implementation Notes
Reuse existing dashboard-oriented filter primitives or component styles where that reduces duplication cleanly, rather than creating another one-off filter variant.

### Acceptance Criteria
- [ ] The index filter section is visually and structurally aligned with the dashboard filter treatment
- [ ] Shared filter styles or component patterns are reused where practical without introducing tight coupling
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0004] Show event authors on index cards
- Status: todo
- Priority: P1
- Type: feature
- Scope: web
- Source: tasks/TODOs.md#L13
- Dependencies: TODO-0002

### Context
Home event listings should show author information consistent with the moderation view so the same event metadata is presented similarly across the application.

### Implementation Notes
Mirror the existing moderation-card author treatment where possible and keep any required data plumbing aligned with the current API and web-layer contracts.

### Acceptance Criteria
- [ ] Index event cards display author information using a treatment that matches or cleanly parallels dashboard moderation cards
- [ ] Any required API or view-model data plumbing preserves current event listing behavior
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0005] Review and polish index page consistency
- Status: todo
- Priority: P2
- Type: tech-debt
- Scope: web
- Source: tasks/TODOs.md#L14-L19
- Dependencies: TODO-0002, TODO-0003, TODO-0004

### Context
After the filter and event-card changes land, the index page still needs a focused consistency review to catch remaining UX or presentation mismatches introduced by the work.

### Implementation Notes
Use the existing codebase patterns, UI conventions, and reference material as guardrails for any final polish instead of creating standalone style churn.

### Acceptance Criteria
- [ ] The index page has been reviewed for visual and interaction consistency after the related changes
- [ ] Any follow-up fixes are limited to concrete index inconsistencies discovered during that review
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0006] Add per-user email delivery preferences
- Status: todo
- Priority: P1
- Type: feature
- Scope: shared
- Source: tasks/TODOs.md#L12
- Dependencies: none

### Context
Users currently do not have fine-grained control over the email categories they receive. The product now needs explicit settings for weekly digest emails, event update emails, and pending-review notifications for admins, with each preference enabled by default and enforced before any email is sent.

### Implementation Notes
Keep the preference model cohesive across persistence, API contract, and settings UI so the same flags drive every email send path without scattering category-specific checks across unrelated modules.

### Acceptance Criteria
- [ ] User settings expose separate toggles for weekly emails, event updates, and admin pending-request emails
- [ ] New and existing users default all email preferences to enabled without runtime schema fallback logic
- [ ] Every relevant email send flow checks the matching user preference before delivery
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0007] Notify admins when events enter approval
- Status: todo
- Priority: P1
- Type: feature
- Scope: api
- Source: tasks/TODOs.md#L11
- Dependencies: TODO-0006

### Context
Submitting an event for approval should immediately notify all admins who are eligible to receive pending-review emails. The notification needs to follow the existing project email styling so the new message feels consistent with current templates and delivery patterns.

### Implementation Notes
Reuse the existing email templating and delivery abstractions instead of introducing a separate notification pipeline, and keep recipient selection aligned with the new per-user preference flags.

### Acceptance Criteria
- [ ] Sending an event for approval triggers a notification email to every opted-in admin
- [ ] The email presentation follows the current project styling and template conventions
- [ ] The notification is integrated into the existing approval-submission flow without duplicating business logic
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0008] Reopen approved events when organizers edit them
- Status: todo
- Priority: P1
- Type: feature
- Scope: shared
- Source: tasks/TODOs.md#L13
- Dependencies: TODO-0006, TODO-0007

### Context
Organizers need to be able to edit events that were already approved. When that happens, the current update flow should be reused, the event must move back to pending review, the existing calendar entry must be removed, and admins must be notified to review the updated submission again.

### Implementation Notes
Extend the current event-update path rather than creating a parallel edit flow, and keep calendar cleanup and admin re-notification tied to the same state transition to avoid divergent review behavior.

### Acceptance Criteria
- [ ] Organizers can edit events that are currently approved
- [ ] Saving an approved event through the organizer flow moves it back to pending review
- [ ] The related calendar event is deleted when an approved event is edited
- [ ] Admins are notified again through the same pending-review email mechanism used for first submission
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)

## [TODO-0009] Let admins edit any event through review status
- Status: todo
- Priority: P1
- Type: feature
- Scope: shared
- Source: tasks/TODOs.md#L14
- Dependencies: TODO-0006

### Context
Admins need authority to edit any user event, including events that were already approved. An admin edit should move the event into a review status that behaves like pending review, notify the owner that the event was changed and needs approval again, remove the existing calendar entry, and only recreate the calendar event if the review cycle ends in approval.

### Implementation Notes
Model review status as part of the existing moderation lifecycle instead of a one-off exception path, and keep user notification plus calendar recreation rules centralized around state transitions.

### Acceptance Criteria
- [ ] Admins can edit any event regardless of its current approval state
- [ ] Admin edits move the event into review status and remove any existing calendar entry
- [ ] The event owner receives an event-update email, subject to preferences, explaining that the event is pending review again
- [ ] Approving a review-status event restores the event to approved state and recreates the calendar event as part of the existing approval behavior
- [ ] Module/class responsibilities remain clear and no unrelated concerns are added to existing files
- [ ] Validation step (manual or automated)
