---
name: skill-updater
description: Update the repository skill guides when a task establishes or clarifies durable coding principles, project styles, structure rules, patterns, or best practices. Use when the user asks to rework code according to maintainability or architecture goals, or when new long-lived conventions should become future guidance.
---

# Skill Updater

Use this skill when a task does more than change code: it also establishes a durable rule that should influence future work.

## When to Use It

Use this skill when the user asks for any of the following:

- remake or refactor code around clean code, OOP, maintainability, scalability, readability, or best practices
- align implementation with project style, structure, patterns, or architectural rules
- make a convention explicit so it can guide future tasks
- create or revise a repository skill because the current guidance is missing, outdated, or too weak

Do not use this skill for one-off implementation details, temporary workarounds, or task-specific decisions that are unlikely to matter again.

## Primary Goal

Convert stable lessons from the current task into the smallest correct documentation update so future agent work uses the same rule by default.

## Update Workflow

1. Identify the durable rule.
2. Confirm it is broader than the immediate diff.
3. Find the narrowest existing guide that should own the rule.
4. Update that guide with concise, directive wording.
5. Only create a new skill when no existing skill is the right long-term owner.
6. If the rule is repository-wide, also update `.github/copilot-instructions.md`.
7. If the rule is useful beyond the current diff and likely to remain true, store a repository memory with citations.

## Ownership Rules

Prefer updating an existing skill before adding a new one.

- Update `api-development` for API routes, validation, auth flows, response contracts, and persistence boundaries.
- Update `entity-models` for model responsibilities, defaults, normalization, and relation-loading rules.
- Update `web-frontend` for SSR, client modules, component patterns, DOM conventions, and frontend API usage.
- Update `css-standards` for layout systems, visual patterns, tokens, component styling, and reusable CSS structure.
- Update `test-first-delivery` for validation expectations, test scope, and regression-prevention practices.
- Update `debugging-operations` for durable diagnostic workflows and verified troubleshooting practices.
- Update `docker-deployment` for stable container and compose workflows.
- Update `.github/copilot-instructions.md` only for rules that should shape the whole repository.

Create a new skill only when the guidance is cross-cutting but still coherent as its own reusable workflow, or when an uncovered domain has recurring decisions that deserve a dedicated guide.

## Writing Rules

- Keep guidance short, direct, and action-oriented.
- Record rules, not narratives.
- Prefer repository facts over generic textbook advice.
- Tie guidance to actual files, flows, or constraints in this repository.
- Avoid duplicating the same rule across many skills unless the overlap is necessary for discoverability.
- Do not document transient bugs, temporary migrations, or speculative preferences.

## Good Candidates for Updates

- a newly established architectural boundary
- a repeated component or helper pattern that should now be reused
- a validated testing command or required verification workflow
- a clarified rule about where logic belongs
- a new repository-wide restriction or preferred abstraction

## Poor Candidates for Updates

- renaming a local variable for readability
- a one-off bug fix with no broader rule
- temporary compatibility code
- assumptions that are not yet verified in code or workflow
- implementation notes that belong only in the current diff or PR description

## Expected Outcome

After the main task work is complete, the relevant skill guides should reflect the new durable rules so future tasks inherit them without re-discovering the same conclusions.