---
name: test-first-delivery
description: Deliver feature work and refactors in this Academic Events repository with tests or explicit validation. Use when changing behavior, adding features, fixing regressions, updating tests, validating changes, or documenting testing gaps across api/ and web/.
---

# Test-First Delivery

Use this skill whenever a task changes behavior in `api/` or `web/`.

## Default Quality Contract

- Code changes alone are not done.
- If the touched area already has automated coverage, update that coverage and run it.
- If automation is missing, choose between a small service-local bootstrap and explicit manual validation.
- Run the narrowest relevant validation path, fix failures, and rerun before finishing.
- Report what was validated, what was not, and why.

## Repository Reality

- This repo is split into two independent Node/Express services: `api/` and `web/`.
- There is currently no committed automated test suite or coverage command in either service.
- The only verified automated validation path today is rebuilding the web bundle from the running Compose web service.
- Manual validation is still the default for many API, auth, database, and SSR flows until a task introduces a stable local harness.

## Workflow

1. Identify which service owns the behavior change: `api/`, `web/`, or both.
2. Check whether the touched service already has automated tests or whether the task is also adding a small service-local harness.
3. Choose the validation path using [references/testing-decision-tree.md](references/testing-decision-tree.md).
4. Run the relevant commands and checks from [references/validation-commands.md](references/validation-commands.md).
5. Fix failures and rerun the validated scope until it passes.
6. Finish with explicit reporting:
   - tests or commands run
   - manual checks performed
   - remaining gaps or unvalidated risk

## Done Criteria

A behavior-changing task is complete only when:

- the implementation is in place,
- automated tests were updated and run when they existed or were intentionally bootstrapped,
- otherwise the manual validation checklist was executed for the touched flow,
- any web asset change was rebuilt through the repo's real workflow,
- and the final report calls out remaining coverage or environment gaps plainly.
