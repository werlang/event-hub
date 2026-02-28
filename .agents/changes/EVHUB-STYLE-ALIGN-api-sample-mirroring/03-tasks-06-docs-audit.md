# Task 6: Documentation Audit and Realignment

**Depends on**: Task 5  
**Estimated complexity**: Medium  
**Type**: Documentation

## Objective
Run and apply the documentation audit so `.github` instructions/skills/prompts accurately reflect the migrated implementation.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `.github/copilot-instructions.md`
- `.github/skills/README.md`
- `.github/skills/*/SKILL.md`
- `.github/skills/*/references/*.md`
- `.github/prompts/*.md`
- `README.md` (only if implementation conflicts)
- `tasks/backlog.md`

## Detailed Steps
1. Update `tasks/backlog.md` to mark this task as `in-progress`.
2. Execute the checklist in `.github/prompts/audit-documentation.md` against post-migration code.
3. Remove stale or aspirational references and update architecture/contracts/security/build notes to real behavior.
4. Ensure docs explicitly reflect: model/driver pattern, relation-backed audience mapping, envelope contracts, JWT-only auth, and compose reality.
5. Perform terminology and consistency sweep across `.github/**`.
6. Produce a concise audit summary section in task handoff notes (files changed + mismatches fixed + remaining code issues).
7. Update `tasks/backlog.md` to mark this task as `done`.

## Acceptance Criteria
- [x] `.github` docs align with current implementation
- [x] No stale references to non-existent systems remain
- [x] Skills and prompts are actionable for future agents
- [x] Audit summary is produced
- [x] Manual review completed

## Inspector Re-Review (2026-02-28)

- **Commit inspected**: `a1bcb174acf5eeabf701bc47707c8350fcf8068f`
- **Decision**: ✅ Complete
- **Mandatory preflight**: Passed in strict order (`just preflight` → `just sct` → `make checks`).
- **Previously reported issue**: Verified fixed — `.github/skills/docker-deployment/SKILL.md` now points API URL troubleshooting to `web/src/js/helpers/api.js` (`resolveApiUrl()`/`requestApi()`).
- **Acceptance**: Task 06 acceptance criteria remain satisfied after re-review.

## Testing
- **Test file**: N/A (documentation verification)
- **Test cases**:
  - grep sweep for known stale terms
  - spot-check major claims against code paths

## Notes
Prefer concrete, verifiable statements over aspirational guidance.

## Inspector Feedback (2026-02-28)

- **Decision**: 🔴 Incomplete
- **Mandatory preflight**: Passed in strict order (`just preflight` → `just sct` → `make checks`).
- **Blocking mismatch**:
  - `.github/skills/docker-deployment/SKILL.md` currently instructs API URL troubleshooting in `web/src/js/index.js`.
  - Actual API URL resolution logic is in `web/src/js/helpers/api.js` (`resolveApiUrl()` used by `requestApi()`).
- **Required rework**:
  - Correct the troubleshooting reference in `.github/skills/docker-deployment/SKILL.md` to point to `web/src/js/helpers/api.js`.
  - Re-run documentation spot-check and keep acceptance criteria aligned with implementation.
