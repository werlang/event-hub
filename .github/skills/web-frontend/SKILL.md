---
name: web-frontend
description: Build and maintain the Academic Events web app (Express SSR shell plus bundled vanilla JavaScript UI). Use when changing the home, login, week, or dashboard pages, client auth and event flows, styles, webpack behavior, static serving, or API integration from the web layer.
---

# Web Frontend Development

## Current Frontend Architecture

Server (`web/app.js`):

- Express + Mustache view engine
- `GET /` renders `index.html`
- `GET /login` renders `login.html`
- `GET /week` renders `week.html`
- `GET /dashboard` renders `dashboard.html`
- static assets served from `web/public/`
- template variables are injected through `res.templateRender()` from `web/middleware/render.js`

Client (`web/src/js/index.js`):

- Builds the public home page
- Loads `/events` immediately with default local date filters
- Uses `EventList`, `FilterForm`, `QuickChips`, `Pagination`, and the shared `Event` class
- Hides the entry surfaces when the URL already carries a specific agenda query

Client (`web/src/js/week.js`):

- Boots the standalone public week page
- Reads SSR-provided `weekFrom`, `weekTo`, and `weekCalendarJoinUrl` template vars
- Loads the current-week event slice and paginates it locally

Client (`web/src/js/dashboard.js`):

- Boots the authenticated dashboard shell
- Orchestrates action tabs, event-management modals, moderation discovery, and settings panels
- Reuses the shared `Event` class for author/timeline presentation and event sorting

Client modules:

- `web/src/js/login.js`: login/register tab switching, token persistence, and redirect handling
- `web/src/js/components/*.js`: class-based UI helpers for tabs, forms, cards, alerts, chips, and lists
- `web/src/js/helpers/api.js`: API base URL resolution + envelope normalization + token helpers (`ae_token`)
- `web/src/js/helpers/query-state.js`: home-page query parsing and URL sync helpers

Build (`web/webpack.config.js`):

- Entries: `web/src/js/index.js`, `web/src/js/login.js`, `web/src/js/week.js`, `web/src/js/dashboard.js`
- Outputs minified JS/CSS into `web/public/`
- Dev server on port `80`, proxying `/` to `http://localhost:3000`

## API Integration in Frontend

`API_URL` resolution in client code:

1. `TemplateVar.get('apiUrl')`
2. `<meta name="api-url">`
3. fallback `''` (relative paths)

Response handling:

- Envelope-aware via `requestApi()`, which normalizes both enveloped and non-enveloped payloads.
- Error UI should read `response.message` from normalized API results.
- The shared browser API client is intentionally limited to `GET`, `POST`, `PUT`, and `DELETE`.
- Login and register flows should redirect to `/dashboard` through the sanitized redirect helper.
- Dashboard settings flows should align with `GET /auth/me`, `PUT /auth/me`, `PUT /auth/me/preferences`, `PUT /auth/password`, `GET /auth/users`, `PUT /auth/users/password/reset`, and `PUT /auth/users/:id/promote`.
- Dashboard event and moderation flows should align with `GET /events/mine`, `GET /events/moderation`, `GET /events`, `PUT /events/:id`, `DELETE /events/:id`, and `PUT /events/:id/moderation`.

When changing API integration behavior, keep this precedence explicit.

## Implementation Guidance

1. Keep client logic modular through the existing class-based component layer in `web/src/js/components/`.
2. When multiple frontend helpers revolve around the same domain object, consolidate them into one focused class instead of keeping scattered function exports. For event-specific presentation and sorting logic, prefer extending or reusing `web/src/js/helpers/event.js`.
3. Preserve current UX flows before adding new UI states.
4. Keep CSS updates in the existing split between page entries (`index.css`, `login.css`, `week.css`, `dashboard.css`) and shared component styles under `web/src/css/components/`.
5. Keep home listing/filter logic in `index.js`, auth behavior in `login.js`, week-only loading in `week.js`, and dashboard-specific orchestration in `dashboard.js` plus the `dashboard/` submodules.
6. Do not document dormant routes or bundle entries that are not wired in `web/app.js` and `web/webpack.config.js`.
7. Maintain Portuguese-facing text consistency already present in forms and messages.
8. For interaction-heavy UI work, do not stop at DOM inspection or bundle success alone; verify the rendered page in a browser and exercise the affected interaction states before considering the task done.

## Validation Expectations

- Update and run the committed Node test suite under `web/tests` when the touched behavior already has route, template, or contract coverage.
- Rebuild the affected web bundle through the repository workflow.
- Open the changed page in a browser session when the environment allows it.
- Exercise the specific interaction that changed: tabs, modals, accordions, filters, form states, redirects, pagination, or dashboard settings flows.
- If authentication gates the page, obtain a real session through the UI or documented local flow before evaluating the change.
- Report both the automated validation and the manual browser checks that were actually performed.

## Common Tasks

- Add a new filter:
  - Update filter input in `index.html`
  - Include field in `createHomeFilterParams(...)` / `readHomeFiltersFromUrl(...)`
  - Ensure API supports the filter

- Extend event card rendering:
  - Update `EventCard` / `EventList`
  - Add styles in `index.css` or the relevant component CSS file

- Change auth behavior:
  - Update `login.js`, `helpers/api.js`, and any affected HTML/components together

## References

- Read [references/component-patterns.md](references/component-patterns.md) when extending page dispatch, query helpers, normalized API calls, or submit handlers.
- The root `.github/references/` folder is also a useful inspiration source for class-based DOM APIs and helper ergonomics.

## Out of Scope (Not in This Repo)

- Server-side i18n namespace injection
- timetable interaction components (drag/drop/split/conflict panels)