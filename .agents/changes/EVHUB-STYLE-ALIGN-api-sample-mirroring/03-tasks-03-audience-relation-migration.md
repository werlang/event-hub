# Task 3: Audience Relation Modeling and Data Migration

**Depends on**: Task 2  
**Estimated complexity**: High  
**Type**: Feature

## Objective
Replace JSON audience storage behavior with relation-backed persistence while preserving API output shape `audience: string[]`.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `api/helpers/datastore.js`
- `api/model/event.js`
- `api/model/relation.js`
- `api/helpers/mysql.js`
- `tasks/backlog.md`

## Detailed Steps
1. Update `tasks/backlog.md` to mark this task as `in-progress`.
2. Add/ensure relation table bootstrap for event audience mapping (UUID event FK + audience value).
3. Implement idempotent migration from legacy JSON audience data (if present) into relation rows.
4. Update event model data access to write/read audiences through relation helper methods.
5. Ensure duplicate audience relation entries are prevented and deletion/update paths remain safe.
6. Validate list/detail/create event flows return stable `audience: string[]` response shape.
7. Update `tasks/backlog.md` to mark this task as `done`.

## Acceptance Criteria
- [ ] Audience data is persisted via relation table semantics
- [ ] Legacy data migration is idempotent
- [ ] API consumers still receive `audience` arrays
- [ ] Duplicate relation insertion is prevented
- [ ] Manual validation completed

## Testing
- **Test file**: N/A (manual validation)
- **Test cases**:
  - create event with audience array and verify relation rows
  - list/detail returns expected audience arrays
  - migration can run repeatedly without duplicating entries

## Notes
Preserve compatibility for existing event reads while transitioning storage internals.

## Inspector Feedback (2026-02-28)
- **Decision**: ✅ Complete
- **Inspected Commit**: `e03c17d2cf2acac65ec198da56027cb36f65b975`
- **Mandatory preflight**: passed in strict order (`just preflight` → `just sct` → `make checks`)
- **Runtime validation evidence**:
  - Authenticated create with duplicate audience input persisted deduplicated relations (`event_audiences` count = 2)
  - `GET /events/:id` and `GET /events?search=...` returned stable `audience: string[]`
  - Legacy JSON migration test remained idempotent after two API restarts (relation count stayed `2`)
