# .github Context Migration Prompt

Migrate a copied `.github/` folder from a **source project** into the **current target project**, then rewrite all relevant files so they accurately describe the target project’s real implementation.

## Goal

Transform copied agent context (instructions, skills, prompts, references) into repository-accurate documentation with **zero stale claims** from the source project.

## Inputs

- Source content already copied into `.github/` of the target repo.
- Target repository codebase (the source of truth).

## Success Criteria

Migration is complete only when:

- All `.github` docs reflect real files, routes, models, scripts, env vars, and architecture in the target project.
- Outdated source-project concepts are removed or rewritten.
- Skill descriptions match actual target domains.
- Prompt files guide work on the target project (not the source).
- No aspirational claims are presented as implemented facts.

---

## Required Scope

Audit and update at least:

1. `.github/copilot-instructions.md`
2. `.github/skills/README.md`
3. `.github/skills/*/SKILL.md`
4. `.github/skills/*/references/*.md`
5. `.github/prompts/*.md`

Also check and update (if present and inconsistent):

- `README.md`
- `constitution.md`
- `specs/*.md`
- `plans/`, `tasks/` docs that reference old architecture

---

## Operating Rules

1. **Code wins over docs**: every statement must be verifiable in the target codebase.
2. **No assumptions**: if you cannot confirm a feature, remove/qualify it.
3. **No cargo-cult migration**: copied examples must be rewritten to target entities/routes.
4. **Preserve useful structure** where possible, but replace wrong technical content.
5. **Keep docs actionable**: include concrete files, commands, and patterns that exist.

---

## Phase 1 — Deep Discovery (Research First)

Build a factual map of the target project before editing docs.

### 1) Inventory the target architecture

Extract from code:

- Services and folders
- Runtime stack/framework versions
- API/web/worker boundaries
- Data/persistence strategy
- Caching/background jobs/message queues
- Docker/compose topology

### 2) Inventory behavior and contracts

Extract from implementation:

- Route list and methods
- Request validation and response shapes
- Auth strategy and middleware
- Domain models and default values
- Environment variables and config files
- Build/dev scripts and execution modes

### 3) Inventory `.github` content to migrate

For each copied file, classify:

- Accurate (keep)
- Partially accurate (rewrite sections)
- Incorrect/outdated (replace)
- Not applicable (remove references)

### 4) Build discrepancy ledger

Track each mismatch as:

- **Old claim**
- **Actual behavior in target**
- **Doc file(s) needing fix**

---

## Phase 2 — Rewrite and Align

Update files in this order:

1. `copilot-instructions.md` (highest priority)
2. `skills/README.md`
3. each `skills/*/SKILL.md`
4. `skills/*/references/*.md`
5. `prompts/*.md`
6. optional root docs (`README`, specs, constitution)

### Rewriting Standards

- Replace source project names and domain nouns everywhere.
- Replace route examples with real target routes.
- Replace model/entity examples with real target models.
- Replace infra references (e.g., Redis, queues, external APIs) unless confirmed in target.
- Replace script/compose commands with commands that exist in target.
- Keep examples minimal and executable in target context.

### Skills Alignment Rules

For each skill:

- `name` should remain stable only if still relevant.
- `description` must state when to use it in target project terms.
- “When to use” list must map to actual target workflows.
- “Key files” must point to real files that exist.
- “Out of scope” section should explicitly reject copied-but-nonexistent systems.

### Prompt Alignment Rules

Each prompt should:

- Reference actual target paths and components.
- Include verification instructions against target code.
- Avoid source-specific assumptions.
- Provide output format that reports changed files + mismatches fixed.

---

## Phase 3 — Validation Pass

### 1) Terminology sweep

Search `.github/**` for stale source terms:

- Old project name(s)
- Old entities/routes
- Old infra names (Redis, queue, provider names) not present in target
- Old compose/env/script assumptions

### 2) Consistency sweep

Validate docs agree on:

- Ports
- Script names
- Route paths
- Auth requirements
- Environment variables
- File locations

### 3) Reality sweep

For every major claim in `.github`, ensure a corresponding implementation exists.

---

## Common Migration Pitfalls (Must Check)

- Skill list mentions skills that do not exist in `.github/skills/`.
- Prompt files reference folders absent in target repo.
- Instructions mention production compose file when only dev compose exists.
- API docs still describe old endpoints, query params, or status codes.
- Frontend docs mention component system that target app does not use.
- Security/testing claims are aspirational and not enforced by tooling.

---

## Output Format (Required)

Provide final report as:

```markdown
## .github Migration Summary

### Files Updated (X)
- [.github/copilot-instructions.md](...) - summary
- [.github/skills/README.md](...) - summary
- ...

### Key Mismatches Fixed
- Fixed: <old claim> -> <target-reality>
- Removed: <nonexistent feature>
- Added: <missing but implemented behavior>

### Remaining Gaps (Code, not Docs)
- <issue found during migration>

### Confidence Check
- Terminology sweep: ✅/⚠️
- Contracts/ports/scripts consistency: ✅/⚠️
- Source-project residue in `.github`: ✅ none / ⚠️ list
```

---

## Optional Execution Checklist

- [ ] Read all `.github` docs before editing
- [ ] Map target architecture from source code first
- [ ] Build mismatch ledger
- [ ] Rewrite instructions + skills + prompts
- [ ] Run stale-term grep across `.github`
- [ ] Produce final migration summary

---

## One-Line Invocation (for future use)

Use this prompt to migrate copied `.github` context from another repository, rewrite all instructions/skills/prompts to match this project’s real implementation, remove source-project residue, and provide a full mismatch-and-fixes report.
