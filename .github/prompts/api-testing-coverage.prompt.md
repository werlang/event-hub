---
name: API Test Coverage
description: Bootstrap or expand automated API tests for the Academic Events service in api/. Use when auth, events, middleware, models, or helpers need deterministic regression coverage, and keep all new automation local to api/.
argument-hint: Optional target routes, helpers, models, or coverage goals
agent: agent
---

Build or expand deterministic API coverage for this repository without introducing cross-service test sprawl.

## Goal

Increase reliable automated coverage for `api/` while keeping the first harness, or any later expansion, local to the API service.

## Repository Reality

- `api/` is an independent Node/Express service with no committed test runner today.
- The repo currently has no standard `npm test` script in `api/package.json`.
- Database-backed and auth flows may still need manual follow-up even after unit or route tests are added.

## Success Criteria

- New automation stays entirely inside `api/`.
- If no API harness exists yet, bootstrap the smallest maintainable one first.
- Tests cover the requested or touched behavior, not unrelated areas.
- The exact API test command added or used is executed until green.
- Any remaining MySQL-, auth-, or integration-only gaps are documented explicitly.
- Web code and web tooling are not changed unless the API task genuinely requires coordinated production fixes.

## Scope Rules

1. Keep new test files, config, scripts, and devDependencies under `api/` only.
2. Prefer deterministic unit and route tests for helpers, middleware, models, and route validation.
3. Mock or isolate external boundaries when the goal is API behavior rather than full integration.
4. If a flow still requires MySQL or running services for confidence, add a manual validation checklist instead of pretending the automation is complete.
5. If you consult `.github/references/api/jest.unit.config.mjs`, treat it as a reference template only, not installed infrastructure.

## Workflow

1. Identify the smallest API surface that needs coverage.
2. Check whether an API-local harness already exists; if not, add the smallest one that fits the task.
3. Add or update tests for the touched behavior.
4. Run the exact API test command you added or relied on.
5. Fix failures and rerun until green.
6. If route behavior still depends on runtime setup, perform and report the matching manual API checks.

## Final Report

Include:

- files changed,
- exact API test command executed,
- whether it passed,
- manual follow-up checks performed,
- and remaining uncovered or integration-only gaps.