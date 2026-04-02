---
name: test-first-delivery
description: Deliver feature work and refactors in this Academic Events repository with tests or explicit validation. Use when changing behavior, adding features, fixing regressions, updating tests, validating changes, or documenting testing gaps across api/ and web/.
---

# Test-First Delivery

Use this skill whenever a task changes behavior in `api/` or `web/`.

## Default Quality Contract

- Code changes alone are not done.
- If the touched area already has automated coverage, update that coverage and run it.
- API feature work must update and run the committed Jest unit suite in `api/tests/unit` via `docker compose -f compose.dev.yaml exec api npm test`.
- API test runs must finish at `100%` passing tests before the task is considered complete.
- New or changed API behavior should add real-life success cases plus meaningful edge cases, not only happy-path assertions.
- Prefer the highest practical coverage for the touched API area, especially branches around validation, authorization, fallback defaults, and error handling.
- If automation is missing, choose between a small service-local bootstrap and explicit manual validation.
- Run the narrowest relevant validation path, fix failures, and rerun before finishing.
- Report what was validated, what was not, and why.

## Repository Reality

- This repo is split into two independent Node/Express services: `api/` and `web/`.
- `api/` now has a committed Jest unit suite rooted at `api/tests/unit` with coverage output in `api/tests/coverage`.
- The verified API validation command is `docker compose -f compose.dev.yaml exec api npm test`.
- The verified automated web validation path today is rebuilding the web bundle from the running Compose web service.
- Manual validation is still the default for many API, auth, database, and SSR flows until a task introduces a stable local harness.
- For frontend interaction changes, manual validation should include a real browser pass over the affected page, not only a compile or static DOM review.

## Workflow

1. Identify which service owns the behavior change: `api/`, `web/`, or both.
2. Check whether the touched service already has automated tests or whether the task is also adding a small service-local harness.
3. Choose the validation path using [references/testing-decision-tree.md](references/testing-decision-tree.md).
4. For API behavior changes, add or update Jest unit tests under `api/tests/unit` alongside the production code change.
5. Run the relevant commands and checks from [references/validation-commands.md](references/validation-commands.md).
6. For frontend interaction changes, open the affected page in a browser session and exercise the changed controls or flows.
7. Fix failures and rerun the validated scope until it passes with no failing tests.
8. Finish with explicit reporting:
   - tests or commands run
   - manual checks performed
   - remaining gaps or unvalidated risk

## Done Criteria

A behavior-changing task is complete only when:

- the implementation is in place,
- automated tests were updated and run when they existed or were intentionally bootstrapped,
- API tasks updated the Jest unit suite for both common and edge-case behavior when the API code changed,
- API test execution finished with `100%` passing tests,
- otherwise the manual validation checklist was executed for the touched flow,
- any web asset change was rebuilt through the repo's real workflow,
- frontend interaction changes were checked in a real browser session when the environment made that possible,
- and the final report calls out remaining coverage or environment gaps plainly.
