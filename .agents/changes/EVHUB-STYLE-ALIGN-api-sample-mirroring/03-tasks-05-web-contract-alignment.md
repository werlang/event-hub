# Task 5: Web Client Contract Alignment

**Depends on**: Task 4  
**Estimated complexity**: Medium  
**Type**: Feature

## Objective
Update the web client to fully support the new API envelope contract and keep all existing user flows functional.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `web/src/js/index.js`
- `web/src/js/login.js`
- `web/src/js/publish.js`
- `web/src/js/helpers/*` (as needed)
- `tasks/backlog.md`

## Detailed Steps
1. Update `tasks/backlog.md` to mark this task as `in-progress`.
2. Add/adjust client-side response parsing helpers for standardized success/error envelopes.
3. Update auth-related UI logic to read tokens/profile data from new envelope payload shape.
4. Update event fetch/list/filter/publish flows to consume new envelope format without UX regressions.
5. Ensure user-facing error messages continue to display meaningful text from API responses.
6. Validate login/register/publish/filter scenarios manually in browser.
7. Update `tasks/backlog.md` to mark this task as `done`.

## Acceptance Criteria
- [x] No frontend runtime errors caused by API contract changes
- [x] Auth flows still work end-to-end
- [x] Event listing/filtering/publishing still work end-to-end
- [x] Envelope errors are surfaced cleanly in UI
- [x] Manual validation completed

## Inspector Result
- ✅ **PASS** (2026-02-28)
- Inspected commit: `71cb050`
- Mandatory preflight passed in strict order: `just preflight` → `just sct` → `make checks`
- Runtime sanity: web routes (`/`, `/login`, `/publish`) responded `200`; auth/events envelopes validated for register/login/me/create/list including error paths (`401`, `400`) with user-facing `message` payloads.
- Decision: Acceptance criteria satisfied with no blocking issues identified.

## Testing
- **Test file**: N/A (manual validation)
- **Test cases**:
  - login/register success and invalid credentials
  - publish event with and without required fields
  - filter/list events and empty state behavior

## Notes
Keep UI/UX minimal and consistent with existing pages; this task is compatibility-focused.
