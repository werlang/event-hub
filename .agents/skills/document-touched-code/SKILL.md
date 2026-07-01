---
name: document-touched-code
description: Add focused JSDoc and comments to touched reusable Event Hub code while avoiding noisy narration of obvious statements.
---

# Document Touched Code

Apply this when creating or refactoring functions, classes, methods, reusable helpers, middleware, tests, or project-local skills.

## Standards

- Add JSDoc for named functions, class methods, exported helpers, and reusable local helpers.
- Keep comments concise and useful.
- Comment why a non-obvious block exists, not what each obvious line does.
- Do not add comments to short anonymous callbacks that are only local wiring.
- Keep route or middleware inline handlers documented immediately above the registration when they contain real logic.
- Prefer deleting stale comments over preserving inaccurate guidance.

## Event Hub Notes

- Render helpers should document template-var safety and falsy value behavior.
- MySQL helper methods should document centralized SQL behavior.
- Frontend model facades should document the endpoint family they own.
- Dashboard collaborators should document their page-specific responsibility.
