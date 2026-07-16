# Agent Standards

## Scope

These rules apply to future human and automated changes in this repository.

## Code Boundaries

- Keep `api/routes`, `api/model`, `api/helpers`, `web/src/html`, `web/src/js`, and `web/src/css` in their current roles.
- Do not rename `api/routes` or migrate the API Jest suite to another runner without an explicit request.
- Keep API route handlers explicit about request validation and entity loading.
- Keep MySQL SQL construction inside `api/helpers/mysql.js`.
- Keep browser endpoint paths inside `web/src/js/model/`.
- Keep DOM rendering and event wiring inside page modules, dashboard collaborators, or reusable components.
- Keep page-specific collaborators small; extract only when it clarifies a real responsibility.

## Simplicity

- Prefer direct, readable code over new abstraction layers.
- Remove stale compatibility paths when the checked-in schema or contract has moved.
- Do not add helper functions for one-line transformations unless they improve naming, testing, or reuse.
- Do not introduce service wrappers, repositories, or global state managers unless the existing code clearly needs them.

## Documentation

- Update docs in the same change when behavior, commands, routes, environment variables, CSS standards, build flow, or validation flow changes.
- Keep `README.md` human-first.
- Put durable implementation rules in `GUIDE.md`, `TESTING.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and `.agents/skills`.
- Correct stale route claims immediately; admin user routes live under `/users`, not `/auth/users`.

## DOM Data Hygiene

- Never store application data in DOM `data-*` attributes. Data attributes are for framework selectors and DOM behavior hooks only.
- All domain data (IDs, values, lookup mappings) must live in dedicated JavaScript structures — plain objects, Maps, or class properties.
- When rendering a list of selectable items, build a lookup map keyed by element ID or index and resolve data from the map at interaction time instead of reading `getAttribute('data-*')`.

## CSS

- Use mobile-first CSS only.
- Allowed breakpoints: `640px`, `768px`, `1024px`, `1280px`, `1536px`.
- Do not add `max-width` media queries.
- Keep page entry CSS as composition layers and component partials scoped.
- Preserve the current warm editorial theme unless redesign is requested.

## Validation

- API: `docker compose -f compose.dev.yaml exec api npm run test:unit`
- Web tests: `docker compose -f compose.dev.yaml exec web npm test`
- Web build: `docker compose -f compose.dev.yaml exec web npm run build`
- Compose: `docker compose -f compose.dev.yaml config`

When automation cannot be run, state exactly why and what remains unverified.
