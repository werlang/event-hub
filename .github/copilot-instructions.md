# Copilot Instructions

Use these repository files as the source of truth:

- `AGENTS.md` for coding standards.
- `GUIDE.md` for architecture, API routes, frontend boundaries, CSS rules, and Compose conventions.
- `TESTING.md` for validation commands.
- `.agents/skills/` for task-specific agent workflows.

## Non-Negotiable Boundaries

- Keep `api/routes`, `api/model`, `api/helpers`, `web/src/html`, `web/src/js`, and `web/src/css` in their current roles.
- Keep API tests on Jest and web tests on Node test runner unless explicitly asked otherwise.
- Keep SQL construction inside `api/helpers/mysql.js`.
- Keep browser endpoint paths inside `web/src/js/model/`.
- Keep render template vars safe through `web/middleware/render.js`.
- Keep CSS mobile-first with only `640px`, `768px`, `1024px`, `1280px`, and `1536px` `min-width` breakpoints.

## Current API Route Groups

- `/auth`: register, login, current session, profile, preferences, password, weekly digest trigger.
- `/users`: self-service password reset and admin user tools.
- `/events`: public event browsing, owner events, moderation, event writes, and moderation decisions.

Admin user routes are:

- `GET /users`
- `PUT /users/password/reset`
- `PUT /users/:id/promote`

Do not document or implement these as `/auth/users`.

## Validation

Preferred Compose commands:

```bash
docker compose -f compose.dev.yaml config
docker compose -f compose.dev.yaml up -d --build
docker compose -f compose.dev.yaml exec api npm run test:unit
docker compose -f compose.dev.yaml exec web npm test
docker compose -f compose.dev.yaml exec web npm run build
```

When changing `web/src/js` or `web/src/css`, regenerate checked-in `web/public` bundles.

## Documentation Rule

If a change touches routes, environment variables, scripts, Compose, build output, CSS conventions, tests, or reusable architecture, update the docs and local skills in the same change.
