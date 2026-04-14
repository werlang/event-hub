# Work Plan

## Overall Status
- Status: blocked
- Summary: Web dependencies were restored with `npm ci`, the local webpack build regenerated required assets, and the web baseline improved to 47/49 passing tests. The baseline is still blocked by two existing dashboard workflow test failures in `web/tests/frontend-workflows.test.mjs`.

## Task List
| Task | Type | Status | Notes |
| --- | --- | --- | --- |
| Confirm relevant frontend/testing guidance and map affected skill files | skill-update | complete | Semantic search completed; existing skill files identified under `.github/skills/`. |
| Update the narrowest skill docs for frontend testing workflow changes | skill-update | untouched | Expected owners likely include `test-first-delivery`, `web-frontend`, or `skill-updater` if durable guidance changes are confirmed. |
| Restore/install web dependencies and required build artifacts for baseline validation | frontend-testing | complete | `web/package-lock.json` already existed, `web/node_modules` was missing, `npm ci` restored dependencies, and `./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings` rebuilt the missing assets successfully. |
| Run baseline web tests and capture failures/successes | frontend-testing | blocked | `cd web && node --test tests/*.test.mjs` initially failed on 5 tests; after the local webpack rebuild it improved to 47/49 passing. Remaining failures: dashboard member workflow assertion (`0 !== 2`) near `frontend-workflows.test.mjs:1494` and admin settings weekly-digest request payload mismatch near `frontend-workflows.test.mjs:1765` (unexpected `{ timezone: 'UTC' }` body on `/auth/weekly-digest/send`). |
| Review follow-up skill/doc updates after frontend-test findings | skill-update | untouched | Use only if test findings establish durable guidance. |

## Handoff Log
- Coder subagent: created `plan.md`, recorded the known baseline (semantic search complete, skill files identified, web test baseline blocked by missing dependencies/build artifacts), and stopped without changing product code.
- Tester subagent: confirmed `web/package-lock.json` was present while `web/node_modules` was missing, restored dependencies with `npm ci`, rebuilt assets with the local webpack toolchain, and reran `node --test tests/*.test.mjs`. Asset-related failures cleared, but 2 dashboard workflow tests still fail, so the frontend baseline is not yet green.
