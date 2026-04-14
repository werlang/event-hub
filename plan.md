# Work Plan

## Overall Status
- Status: implementation complete
- Summary: Updated the stale frontend workflow expectations only: the member dashboard workflow now uses future-relative browse fixtures and asserts the default hide-past checkbox state, the admin manual-digest expectation now includes the `{ timezone }` request body, and the narrow frontend/testing guidance files now document both contracts. Tests were not run per request.

## Task List
| Task | Type | Status | Notes |
| --- | --- | --- | --- |
| Confirm relevant frontend/testing guidance and map affected skill files | skill-update | complete | Semantic search completed; existing skill files identified under `.github/skills/`. |
| Update the narrowest skill docs for frontend testing workflow changes | skill-update | complete | Documented that dashboard browse defaults hide past events and that the admin manual digest flow posts the browser time zone to `POST /auth/weekly-digest/send`. |
| Restore/install web dependencies and required build artifacts for baseline validation | frontend-testing | complete | `web/package-lock.json` already existed, `web/node_modules` was missing, `npm ci` restored dependencies, and `./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings` rebuilt the missing assets successfully. |
| Run baseline web tests and capture failures/successes | frontend-testing | blocked-by-stale-tests | `cd web && node --test tests/frontend-workflows.test.mjs --test-name-pattern "dashboard member workflow|dashboard admin settings"` reproduces the same 2 failures. No additional product failures were found in this review pass. |
| Review remaining frontend baseline failures and classify test vs product | frontend-review | complete | `frontend-workflows.test.mjs:1494` is stale against `web/src/js/dashboard/filters.js` + `dashboard.js`: default browse filters set `includePast: false`, so the fixed 2026-04-12/14 fixtures are no longer guaranteed visible. `frontend-workflows.test.mjs:1765` is stale against `web/src/js/dashboard/settings-panels.js`: manual digest intentionally posts `{ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }`, and the API route/tests already validate that contract. |
| Update stale frontend workflow expectations and durable guidance | frontend-testing | complete | `web/tests/frontend-workflows.test.mjs` now uses future-relative member-dashboard dates, asserts the default hide-past checkbox remains off, and expects the admin manual-digest timezone body; `.github/skills/web-frontend/SKILL.md`, `.github/skills/test-first-delivery/SKILL.md`, and `.github/copilot-instructions.md` now document both contracts. |
| Review follow-up skill/doc updates after frontend-test findings | skill-update | complete | Added durable guidance to `web-frontend/SKILL.md`, `test-first-delivery/SKILL.md`, and `.github/copilot-instructions.md` for the dashboard default hide-past browse behavior and the manual-digest timezone payload contract. |

## Handoff Log
- Coder subagent: created `plan.md`, recorded the known baseline (semantic search complete, skill files identified, web test baseline blocked by missing dependencies/build artifacts), and stopped without changing product code.
- Tester subagent: confirmed `web/package-lock.json` was present while `web/node_modules` was missing, restored dependencies with `npm ci`, rebuilt assets with the local webpack toolchain, and reran `node --test tests/*.test.mjs`. Asset-related failures cleared, but 2 dashboard workflow tests still fail, so the frontend baseline is not yet green.
- Reviewer subagent: confirmed both remaining failures are stale expectations. Recommended minimal next actions are test-only changes plus narrow documentation updates: make the member-workflow fixtures future-safe or explicitly enable the past-events filter before asserting list contents, update the admin digest expectation to include the `timezone` request body, and document the manual digest route/timezone + past-event default in the frontend/testing guidance files.
- Coder subagent: updated `web/tests/frontend-workflows.test.mjs` for the dashboard hide-past and manual-digest timezone contracts, refreshed the narrow skill/instruction guidance files, updated `plan.md`, and intentionally did not run tests per request.
