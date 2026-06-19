---
name: skill-updater
description: Auto-detect when generated code, prompts, or repeated agent behavior indicate a reusable workflow or durable rule. Update README, SKILL.md files, prompts, Copilot instructions, or durable coding conventions to reflect those lessons. Auto-invoke when user or agent text contains the exact phrases: "update docs", "update the skill", "fix Copilot instructions", "create new skill", "update skill", "document recurring pattern", "capture reusable workflow", or "this should be a skill".
---

# Skill Updater

Use this skill when a task does more than change code: it also establishes a durable rule that should influence future work.

Use it by default when the task is about any of these:

- updating README or repository documentation so it matches the real codebase
- updating project-wide coding standards or agent instructions
- writing or revising skill files, prompt files, or Copilot instructions
- turning a repeated implementation preference into a documented convention
- clarifying where logic should live, how code should be structured, or what style future work should follow
- recording a maintainability or readability decision that should survive beyond the current diff

## When to Use It

Use this skill when the user asks for any of the following:

- remake or refactor code around clean code, OOP, maintainability, scalability, readability, or best practices
- align implementation with project style, structure, patterns, or architectural rules
- make a convention explicit so it can guide future tasks
- create or revise a repository skill because the current guidance is missing, outdated, or too weak
- update the repository instruction set so future agents are less likely to repeat the same mistake or omission
- run a documentation audit because `.github` files, prompts, or README content no longer match the current routes, pages, scripts, or tests

Do not use this skill for one-off implementation details, temporary workarounds, or task-specific decisions that are unlikely to matter again.

## Discovery Note

The frontmatter `description` is the discovery surface. Include the exact trigger phrases users or the agent might use so this skill can be auto-invoked. Add phrases such as "update docs", "update the skill", "fix Copilot instructions", "create new skill", "update skill", "document recurring pattern", "capture reusable workflow", and "this should be a skill".

## Auto-Invocation (agent-enabled)

This skill should be auto-invoked when the agent's own output, or the user's prompt, matches any of these conditions:

- Prompt contains any exact trigger phrase listed above.
- Agent-generated code implements a reusable pattern (new helper, component, prompt, or orchestration) that is:
  - non-trivial in size (e.g., >= 5 lines) and/or
  - present across multiple files or modules, and/or
  - accompanied by new prompt files or `.github/` guidance, and/or
  - clearly named or structured for reuse (e.g., names like "util", "service", "client", "middleware", "skill").
- The agent performed the same or very similar transformation two or more times in the current session.
- Files under `.github/skills/`, `.github/copilot-instructions.md`, or other `.github/` prompt directories are added or modified.
- Documentation or tests are updated to codify behavior beyond the immediate diff.

When auto-invoked the agent should:

1. Identify the durable rule and the smallest correct home (an existing skill, `.github/copilot-instructions.md`, or README).
2. Decide whether to update an existing skill or create a new one; prefer updating when a clear owner exists.
3. Propose a concise name and short description for any new skill, and a one-paragraph diff summary for any update.
4. Write or patch the relevant SKILL.md using directive, example-driven guidance and minimal boilerplate.
5. Link the skill change to the motivating task (include citations to changed files and prompts).
6. Commit the change and surface it in the task summary so reviewers can confirm the guidance.

## Primary Goal

Convert stable lessons from the current task into the smallest correct documentation update so future agent work uses the same rule by default.

## Update Workflow

1. Identify the durable rule.
2. Confirm it is broader than the immediate diff.
3. Find the narrowest existing guide that should own the rule.
4. Update that guide with concise, directive wording.
5. Only create a new skill when no existing skill is the right long-term owner.
6. If the rule is repository-wide, also update `.github/copilot-instructions.md`.
7. If the request is a documentation audit, also check `README.md`, `.github/skills/README.md`, and any prompts or references that repeat the stale claim.
8. If the rule is useful beyond the current diff and likely to remain true, store a repository memory with citations.

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
- Prefer direct code over tiny helpers when a 1-2 line function does not clearly improve reuse, clarity, or maintainability.
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

If the work produces a repeatable preference but not a new implementation, still update the narrowest applicable skill and, when repository-wide, `.github/copilot-instructions.md`.