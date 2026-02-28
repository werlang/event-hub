# Task 1: API Primitives and App Pipeline Alignment

## INSPECTOR FEEDBACK (2026-02-28, Final Re-inspection)

### Decision
🟢 **Complete**

### What was validated
- Reviewed latest coder commit: `de61ee0bf1713cad0c07036e19d99cc9aa7e41f8`.
- Ran required preflight sequence in strict order:
  1. `just preflight` → passed (`[preflight] running sct` → `[checks] all checks passed`)
  2. `just sct` → passed (`[sct] running repository checks` → `[checks] all checks passed`)
  3. `make checks` → passed (`[checks] all checks passed`)
- Runtime sanity re-checks on live stack:
  - `GET /ready` → `200` with success envelope `{"error":false,"status":200,"data":{"ready":true},"message":"I am ready!"}`.
  - `GET /this-route-does-not-exist` → `404` with standardized error envelope.
  - Authenticated forced error via `POST /events` (`audience: {}`) → `500` with standardized middleware envelope and safe debug detail in non-production.

### Completion notes
- Acceptance criteria are satisfied for Task 1 in current repository state.
- Preflight policy gate is now enforceable and passing in this environment.

## INSPECTOR FEEDBACK (2026-02-28, Re-inspection)

### Decision
🔴 **Incomplete**

### What was validated
- Reviewed latest coder commit: `a0f9245ef63c733a72216cb97e29d085aa06402b`.
- Ran required preflight sequence in order:
  1. `just preflight` → failed (`just: command not found`)
  2. `just sct` → failed (`just: command not found`)
  3. `make checks` → passed (`[checks] all checks passed`)
- Runtime spot-checks against running stack:
  - `GET /ready` → `200` standardized success envelope.
  - `GET /this-route-does-not-exist` → `404` standardized error envelope.
  - `POST /events` without bearer token → `401` standardized error envelope from centralized middleware path.

### What is done
- Centralized primitives and app pipeline updates are present (`CustomError`, `sendSuccess`, readiness route, explicit 404 forwarding, terminal error middleware).
- Route/middleware ad-hoc `res.status(...).json({ error: ... })` patterns were replaced in inspected API files.
- `make checks` target exists and passes in current Docker-based environment.

### What is missing / wrong
- **Primary validation gate failed**: required preflight commands `just preflight` and `just sct` are not runnable in this environment; by policy this task cannot be marked complete.
- **Required test path not re-validated in this pass**: the requested middleware `500` case was not demonstrated from the provided unauthenticated probe path (it returned `401`, as expected without a token).

### Required next steps
1. Restore preflight tooling contract by making `just preflight` and `just sct` executable in the project environment (or formally update/approve the inspector preflight policy for this repo).
2. Re-run the full required preflight sequence with successful outputs captured.
3. Re-attach concise runtime evidence for 200/404/500 envelopes using an authenticated 500 trigger path.

## INSPECTOR FEEDBACK (2026-02-28)

### Decision
🔴 **Incomplete**

### What was validated
- Reviewed latest coder commit: `e0c85ef66b4873519bc8df524433e71ca2fe4363`.
- Ran required preflight sequence in order:
  1. `just preflight` → failed (`just: command not found`)
  2. `just sct` → failed (`just: command not found`)
  3. `make checks` → failed (`No rule to make target 'checks'`)
- Inspected runtime integration points in `api/app.js`, `api/routes/auth.js`, `api/routes/events.js`, and `api/middleware/auth.js`.

### What is done
- Added `CustomError` helper in `api/helpers/error.js`.
- Added success helper in `api/helpers/response.js`.
- Added centralized error middleware in `api/middleware/error.js` and wired it in `api/app.js`.
- Added readiness endpoint (`GET /ready`) and explicit 404 forwarding in `api/app.js`.

### What is missing / wrong
- **Primary validation gate failed**: required preflight checks did not pass; per inspection policy this task cannot be marked complete.
- **Acceptance criterion not substantiated**: "Manual validation completed" is claimed but no reproducible evidence/logs are attached in task/progress artifacts.
- **Integration inconsistency remains**: route handlers still return route-local ad-hoc error payloads (`{ error: '...' }`) in `api/routes/auth.js`, `api/routes/events.js`, and `api/middleware/auth.js`, bypassing centralized error middleware contract.

### Required next steps
1. Provide/restore runnable project checks (`just` targets or `make checks`) and re-run preflight successfully.
2. Attach concise manual validation evidence for readiness, 404, and 500 envelope behavior.
3. Route error paths through `next(error)` + centralized middleware (or explicitly defer with updated acceptance criteria approved by reviewer).

## REWORK EVIDENCE (2026-02-28)

### Preflight Gate
- `make checks` (root): **PASS**
- Output summary:
  - `[checks] validating API JavaScript syntax inside container`
  - `[checks] validating Web JavaScript syntax inside container`
  - `[checks] all checks passed`

### Manual Validation Evidence
- `GET /ready` returned HTTP `200` with envelope:
  - `{"error":false,"status":200,"data":{"ready":true},"message":"I am ready!"}`
- Unknown route `GET /this-route-does-not-exist` returned HTTP `404` with envelope:
  - `{"error":true,"status":404,"type":"Not Found","message":"I am sorry, but I think you are lost."}`
- Forced middleware error via `POST /events` with invalid `audience` object returned HTTP `500` with envelope:
  - `{"error":true,"status":500,"type":"Internal Server Error","message":"Internal Server Error","data":{"detail":"audience.split is not a function"}}`

## REWORK EVIDENCE (2026-02-28, Preflight Contract Fix)

### Environment Tooling
- Installed `just` in this environment using Homebrew for reproducibility (`brew install just`).
- Verified availability:
  - `which just` → `/opt/homebrew/bin/just`
  - `just --version` → `just 1.46.0`

### Repository Contract
- Added root `justfile` with:
  - `preflight` recipe delegating to `just sct`
  - `sct` recipe executing `make checks`

### Required Sequence (in order)
1. `just preflight` → **PASS** (`[preflight] running sct`, `[sct] running repository checks`, `[checks] all checks passed`)
2. `just sct` → **PASS** (`[sct] running repository checks`, `[checks] all checks passed`)
3. `make checks` → **PASS** (`[checks] all checks passed`)

**Depends on**: None  
**Estimated complexity**: Medium  
**Type**: Refactoring

## Objective
Introduce shared API primitives (custom error, response helper, centralized error middleware) and align `api/app.js` startup pipeline to sample-style readiness/404/error flow.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `api/helpers/error.js`
- `api/helpers/response.js` (create)
- `api/middleware/error.js` (create)
- `api/app.js`
- `tasks/backlog.md`

## Detailed Steps
1. Update `tasks/backlog.md` to mark this task as `in-progress`.
2. Define/normalize a `CustomError` contract in `api/helpers/error.js` with status/message/data support.
3. Create `api/helpers/response.js` for standardized success envelope helpers used by routes.
4. Create centralized `api/middleware/error.js` that maps known errors and sanitizes unknown failures.
5. Update `api/app.js` to include sample-like readiness route and explicit 404 fallback, then register centralized error middleware last.
6. Validate startup flow manually (`npm run development`) and check readiness/404/error envelope behavior.
7. Update `tasks/backlog.md` to mark this task as `done`.

## Acceptance Criteria
- [ ] Centralized error middleware exists and is wired in `api/app.js`
- [ ] Success response helper exists for envelope consistency
- [ ] Readiness and explicit 404 handling are present
- [ ] No route-specific ad-hoc error response format introduced
- [ ] Manual validation completed

## Testing
- **Test file**: N/A (manual validation)
- **Test cases**:
  - hit readiness endpoint and confirm expected success shape
  - hit unknown endpoint and confirm standardized 404 envelope
  - trigger middleware error path and confirm standardized 500 envelope

## Notes
Keep this task infrastructure-focused; do not yet refactor all route internals beyond integration points needed for bootstrapping.
