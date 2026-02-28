# Task 4: Route, Auth, and Envelope Contract Refactor

**Depends on**: Task 1, Task 2, Task 3  
**Estimated complexity**: High  
**Type**: Refactoring

## Objective
Refactor routes and auth stack to sample-style `next(error)` control flow, consistent envelopes, and production-hardened JWT practices.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `api/routes/auth.js`
- `api/routes/events.js`
- `api/middleware/auth.js`
- `api/helpers/token.js`
- `api/helpers/response.js`
- `api/middleware/error.js`
- `tasks/backlog.md`

## Detailed Steps
1. Update `tasks/backlog.md` to mark this task as `in-progress`.
2. Refactor all route handlers to use `try/catch` with `next(error)` and shared success response helpers.
3. Keep JWT-only middleware behavior but normalize auth failures to the common error envelope.
4. Harden token helper behavior for production (required strong secret, safe defaults for non-prod).
5. Standardize success envelope for register/login/me/events list/detail/create responses.
6. Validate auth and event flows manually and confirm no mixed response contracts remain.
7. Update `tasks/backlog.md` to mark this task as `done`.

## Acceptance Criteria
- [x] Route handlers use centralized error pipeline (no ad-hoc catch responses)
- [x] JWT-only auth remains in place
- [x] Production token configuration enforces secret policy
- [x] All affected endpoints return consistent success envelope
- [x] Manual validation completed

## Inspector Result
- ✅ **PASS** (2026-02-28)
- Inspected commit: `e1f5be8`
- Mandatory preflight passed in strict order: `just preflight` → `just sct` → `make checks`
- Decision: Acceptance criteria satisfied with no blocking issues identified.

## Testing
- **Test file**: N/A (manual validation)
- **Test cases**:
  - register/login/me success + failure cases
  - unauthorized events creation returns standardized auth error
  - validation failures return standardized 400 envelopes

## Notes
Do not introduce additional auth providers or new functional endpoints beyond mirroring scope.
