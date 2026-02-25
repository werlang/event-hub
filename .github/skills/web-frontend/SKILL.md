---
name: web-frontend
description: Build and maintain the Academic Events web app (Express SSR shell plus bundled vanilla JavaScript UI). Use when changing landing page structure, client auth and event flows, styles, webpack behavior, static serving, or API integration from the web layer.
---

# Web Frontend Development

## Current Frontend Architecture

Server (`web/app.js`):

- Express + Mustache view engine
- `GET /` renders `index.html`
- static assets served from `web/public/`

Client (`web/src/js/index.js`):

- Handles login/register submits
- Persists token in `localStorage` key `ae_token`
- Calls API endpoints for profile/events
- Renders event cards and filter results
- Handles event publish flow

Build (`web/webpack.config.js`):

- Entry: `web/src/js/index.js`
- Outputs minified JS/CSS into `web/public/`
- Dev server on port `80`, proxying `/` to `http://localhost:3000`

## API Integration in Frontend

`API_URL` resolution in client code:

1. `window.APP_CONFIG.apiUrl`
2. `<meta name="api-url">`
3. fallback `''` (relative paths)

When changing API integration behavior, keep this precedence explicit.

## Implementation Guidance

1. Keep client logic modular by function (rendering, fetch, auth, events).
2. Preserve current UX flows before adding new UI states.
3. Keep CSS updates in `web/src/css/index.css` unless a clear split is needed.
4. Use existing naming conventions (`state`, `els`, helper functions) in `index.js`.
5. Maintain Portuguese-facing text consistency already present in forms and messages.

## Common Tasks

- Add a new filter:
  - Update filter input in `index.html`
  - Include field in `qs(...)` params in `index.js`
  - Ensure API supports the filter

- Extend event card rendering:
  - Update `renderEvents()` template in `index.js`
  - Add styles in `index.css`

- Change auth behavior:
  - Update `fetchProfile()`, `handleAuthSubmit()`, and token storage logic together

## References

- Read [references/component-patterns.md](references/component-patterns.md) when extending state management, submit handlers, query helpers, or init flow in `web/src/js/index.js`.

## Out of Scope (Not in This Repo)

- Component class system with many reusable UI modules
- Server-side i18n namespace injection
- timetable interaction components (drag/drop/split/conflict panels)