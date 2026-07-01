---
name: documentation-maintenance
description: Keep Event Hub documentation, agent guidance, prompts, skills, comments, and validation instructions synchronized with the real implementation after code, route, config, CSS, build, Compose, or test changes.
---

# Documentation Maintenance

Use this skill after changes that affect:

- API or Web behavior
- routes or response contracts
- environment variables
- Docker Compose or deployment commands
- package scripts or build output
- CSS architecture or breakpoints
- test commands or validation flow
- reusable project conventions

## Canonical Files

- `README.md`: short human-facing overview and links.
- `GUIDE.md`: architecture and implementation boundaries.
- `TESTING.md`: validation commands and test expectations.
- `AGENTS.md`: durable coding standards.
- `.github/copilot-instructions.md`: concise Copilot-facing summary.
- `.agents/skills/*/SKILL.md`: task-specific local agent guidance.
- `.agents/prompts/*.md`: reusable audit and repair prompts.

## Rules

- Verify documentation against code before editing.
- Remove stale claims instead of adding caveats for old behavior.
- Keep `/users` admin routes documented as `/users`, never `/auth/users`.
- Keep frontend API calls documented as belonging to `web/src/js/model/`.
- Keep CSS guidance mobile-first with allowed breakpoints `640/768/1024/1280/1536`.
- Keep validation commands aligned with `npm run test:unit`, `npm test`, and `npm run build`.

