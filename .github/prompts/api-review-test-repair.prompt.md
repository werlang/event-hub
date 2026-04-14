---
name: API Review Test Repair
description: Review `api/` for bugs, create or update deterministic Jest regressions, run the API suite, fix failures, and iterate with delegated reviewer, tester, and coder subagents until everything passes.
argument-hint: Optional API routes, files, or bug focus
agent: agent
---

Run an end-to-end API bug-hunting and repair loop for this repository.

## Goal

Find real bugs in `api/`, prove them with deterministic tests, fix the root causes, and keep iterating until the API Jest suite is fully green.

## Delegation Requirement

Do not keep reviewer, tester, and coder work inside the main agent.

Delegate with subagents using these exact names:

- `Task Reviewer 0.1` for skeptical bug review and reopened-task validation
- `Task Tester 0.1` for creating or updating tests and executing them
- `Task Coder 0.1` for implementing one focused bug fix at a time

When the work spans multiple bugs or iterations, use `Task Orchestrator 0.1` to maintain the plan and sequence the delegated passes.

## Workflow

1. Scope the requested API area or, if no scope is given, inspect `api/` for the highest-risk bug surfaces.
2. Have the reviewer identify concrete production bugs, not style-only comments.
3. Have the tester add or update deterministic Jest regressions in `api/tests/unit` for each accepted bug or missing branch.
4. Run `docker compose -f compose.dev.yaml exec api npm test -- --runInBand`.
5. If tests fail, delegate the smallest root-cause fix to the coder.
6. Rerun the tester after every coding pass.
7. Send the updated result back to the reviewer to look for remaining bugs or weak coverage.
8. Repeat reviewer -> tester -> coder -> tester until:
   - the reviewer has no unresolved bug findings,
   - the API suite is green,
   - and all touched regressions are committed to `api/tests/unit`.

## Constraints

- Keep all new automation inside `api/`.
- Prefer focused unit or route tests with mocks over brittle integration scaffolding.
- Fix the production root cause instead of weakening the test.
- Do not stop after one green rerun if the reviewer still has unresolved findings.
- Do not stop after a review pass if the bugs are still unproven by tests when deterministic coverage is practical.

## Success Criteria

- real API bugs were reviewed, not only syntax or style issues
- missing regressions were added where practical
- the exact API command above was executed until green
- the final API suite ended with `100%` passing tests
- remaining MySQL-, SMTP-, or other integration-only gaps were called out explicitly

## Final Report

Include:

- bugs found and fixed
- tests added or updated
- exact API command executed
- whether it passed
- remaining uncovered or integration-only risks