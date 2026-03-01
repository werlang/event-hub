# Documentation Audit Prompt

Perform a documentation audit so `.github` guidance matches the **actual** Academic Events codebase.

## Objective

Verify and fix documentation so it reflects real implementation in:

- `api/` (auth + events API)
- `web/` (SSR + client bundle)
- `compose.dev.yaml` (development containers)

Remove references to non-existent features (Redis, timetable entities, proposal flow, i18n namespaces, etc.).

## Scope

### Files to Audit

1. `.github/copilot-instructions.md`
2. `.github/skills/README.md`
3. `.github/skills/*/SKILL.md`
4. `.github/skills/*/references/*.md`
5. `.github/prompts/*.md`
6. Optionally `README.md` if it conflicts with implementation

### What to Verify Against

- `api/app.js`
- `api/routes/auth.js`
- `api/routes/events.js`
- `api/model/user.js`
- `api/model/event.js`
- `api/helpers/token.js`
- `api/middleware/auth.js`
- `web/app.js`
- `web/src/js/index.js`
- `web/src/js/login.js`
- `web/src/js/publish.js`
- `web/src/js/helpers/api.js`
- `web/src/html/index.html`
- `web/webpack.config.js`
- `compose.dev.yaml`
- `api/package.json`, `web/package.json`

## Method

### Phase 1 — Discovery

1. Read existing docs under `.github/`
2. Read source files above
3. Note mismatches and aspirational claims

### Phase 2 — Corrections

Update docs to match real behavior:

- API routes and payload expectations
- Auth/JWT flow and middleware behavior
- Domain model rules and defaults
- Docker compose reality (dev file only)
- Web architecture and current client flow

### Phase 3 — Validation

1. List all files updated
2. List key mismatches fixed
3. List remaining code issues discovered during audit

## Common Mismatches to Remove

- Timetable/professor/class/classroom/card domain references
- Redis cache layers and cache keys
- Edupage external API requirements
- Production `compose.yaml` assumptions (if absent)
- i18n namespace lists not present in code
- CI/testing requirements that do not exist

## Output Template

```markdown
## Documentation Audit Summary

### Files Updated (X files)
- [.github/copilot-instructions.md](...) - summary
- [...](...) - summary

### Key Discrepancies Fixed
- Fixed: old claim -> real behavior
- Removed: non-existent feature references

### Remaining Issues (Code, not Docs)
- [issue]

### Status
✅ `.github` docs aligned with current implementation
```