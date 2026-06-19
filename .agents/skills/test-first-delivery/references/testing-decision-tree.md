# Testing Decision Tree

Use this decision tree before finishing any feature, bug fix, or refactor that changes behavior.

## 1. Scope The Change

- `api/` only: routes, middleware, models, helpers, auth, MySQL-backed behavior.
- `web/` only: SSR routes, bundled client code, DOM helpers, styling, webpack output.
- cross-service: auth flows, dashboard creation, browser-to-API interactions, Compose/runtime wiring.

## 2. Prefer Existing Automation First

- If the touched service already has automated tests by the time you are working, update them and run the narrowest relevant command.
- For `web/`, prefer the committed Node suite first: helper/contract tests, `jsdom` plus VM workflow tests, or spawned route/template checks.
- Do not add a root-level or shared test harness for a service-local change.

## 3. When Bootstrapping Tests Is Appropriate

Bootstrap only when the harness can stay small, local, and clearly beneficial to the changed behavior.

### API bootstrap is usually acceptable when:

- the change lives entirely inside `api/`,
- the behavior is deterministic enough for unit or route tests,
- the harness can stay inside `api/` with local scripts, dependencies, and test files,
- and adding the harness is less risky than relying only on manual database-backed checks.

Examples:

- model defaults and normalization
- helper behavior with pure inputs/outputs
- auth middleware parsing and error handling
- route validation and response envelopes

### Web bootstrap is acceptable only when:

- the change stays inside `web/`,
- the target is a pure helper or narrowly isolated component,
- the harness can remain local to `web/`,
- and the task does not need full browser, webpack-dev-server, or SSR integration just to validate the core behavior.

Examples:

- query parsing helpers
- date formatting helpers
- pure sorting/filter helpers

## 4. When Manual Validation Is The Honest Path

Prefer manual validation when any of these are true:

- no existing automation is present and a new harness would dominate the task,
- the change spans both `api/` and `web/`,
- the flow depends heavily on MySQL state, JWT auth, Compose networking, or real browser rendering,
- the task is mostly about CSS/layout, focus timing, animation, storage persistence, redirects, or authenticated interaction branches that the current Node-based suite cannot prove end-to-end,
- or the task is mostly UI behavior that is faster to verify in the running app than to bootstrap safely.

## 5. Bootstrap Rules

If you introduce tests in this repo:

- keep them inside the touched service only,
- add service-local scripts in that service's `package.json`,
- avoid changing both services' toolchains unless the task truly requires it,
- keep the first harness small and deterministic,
- and report the exact new test command that was added and executed.

## 6. Reference Material

- `.github/references/api/jest.unit.config.mjs` is only a repository reference file, not active test infrastructure.
- Use it as a starting point only if the task explicitly bootstraps API tests and the chosen approach still fits the current repo.
