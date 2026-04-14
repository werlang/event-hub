---
name: api-bug-review
description: Deeply review the Academic Events API in `api/` for logic bugs, contract mismatches, authorization gaps, state-transition defects, background-task failures, time/date bugs, and missing regression coverage. Use when auditing API code for bugs or pairing bug-finding with deterministic Jest test creation and reruns.
---

# API Bug Review

Use this skill for skeptical API review work in `api/` when the goal is to find real bugs, prove them, and lock them down with regression tests.

## Required Pairing

Always pair this skill with [../test-first-delivery/SKILL.md](../test-first-delivery/SKILL.md).

This skill finds likely defects.
`test-first-delivery` supplies the required contract for adding or updating tests and running the API suite until it is green.

## Focus Areas

Prioritize defects that can change behavior, data, permissions, or runtime stability:

- auth and role enforcement
- ownership and moderation transitions
- request validation and status-code mapping
- date, time-zone, and week-range calculations
- background-task loading and boot behavior
- external side-effect orchestration such as e-mail and calendar publishing
- model normalization, filtering, and default propagation
- error wrapping that hides or corrupts the real failure mode

Do not spend the review on style-only suggestions or refactors without a concrete bug risk.

## Review Workflow

1. Scope the API surface under review: routes, middleware, models, helpers, and related tests.
2. Read the production code first and identify the highest-risk state transitions and boundaries.
3. Look for contract mismatches between route docs, guard logic, model filters, and side effects.
4. For each likely bug, decide whether it is already covered by a deterministic Jest test.
5. If not covered, add or update a focused regression test in `api/tests/unit`.
6. Run `docker compose -f compose.dev.yaml exec api npm test -- --runInBand`.
7. If a regression fails, fix the production root cause, not only the symptom.
8. Rerun the API suite until it ends with `100%` passing tests.
9. Report findings ordered by severity, then list remaining integration-only gaps.

## Bug Heuristics

Prefer investigating these patterns early:

- helpers or routes that convert dates through locale strings and then parse them back
- guards whose acceptance criteria are broader than the documented route contract
- startup code that imports optional modules without isolating failures
- background or notification flows that can crash the main request or process
- tests that only prove happy paths while state transitions have multiple branches
- route comments or prompt docs that say `pending`, `owner-only`, or `admin-only` while code accepts more states

## Output Expectations

When the user asked for a review, findings come first.

Each finding should include:

- severity
- the affected API file and behavior
- why it is a bug or likely runtime defect
- whether a regression test was added or still missing

Keep summaries brief. The value of this skill is in precise bug finding plus executable regression coverage.