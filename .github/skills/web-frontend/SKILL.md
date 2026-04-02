---
name: web-frontend
description: Build and maintain the Academic Events web app (Express SSR shell plus bundled vanilla JavaScript UI). Use when changing landing page structure, client auth and event flows, styles, webpack behavior, static serving, or API integration from the web layer.
---

# Web Frontend Development

## Current Frontend Architecture

Server (`web/app.js`):

- Express + Mustache view engine
- `GET /` renders `index.html`
- `GET /login` renders `login.html`
- `GET /publish` renders `publish.html`
- static assets served from `web/public/`
- template variables are injected through `res.templateRender()` from `web/middleware/render.js`

Client (`web/src/js/index.js`):

- Loads the public home page only
- Builds `EventList`, `FilterForm`, and `QuickChips` components
- Syncs filters with the URL and loads `/events` via `apiClient`

Client modules:

- `web/src/js/login.js`: login/register tab switching and hash sync
- `web/src/js/components/*.js`: class-based UI helpers for tabs, forms, cards, alerts, chips, and lists
- `web/src/js/helpers/api.js`: API base URL resolution + envelope normalization + token helpers (`ae_token`)
- `web/src/js/helpers/query-state.js`: home-page query parsing and URL sync helpers

Build (`web/webpack.config.js`):

- Entries: `web/src/js/index.js`, `web/src/js/login.js`
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

When changing API integration behavior, keep this precedence explicit.

## Implementation Guidance

1. Keep client logic modular through the existing class-based component layer in `web/src/js/components/`.
2. Preserve current UX flows before adding new UI states.
3. Keep CSS updates in the existing split: `index.css` for the public pages, `login.css` for auth-specific layout.
4. Keep home listing/filter logic in `index.js`; keep auth-tabs behavior in `login.js`.
5. If you add publish-page behavior, wire a real bundle entry first instead of documenting a non-existent `publish.js` file.
6. Maintain Portuguese-facing text consistency already present in forms and messages.
7. For interaction-heavy UI work, do not stop at DOM inspection or bundle success alone; verify the rendered page in a browser and exercise the affected interaction states before considering the task done.

## Validation Expectations

- Rebuild the affected web bundle through the repository workflow.
- Open the changed page in a browser session when the environment allows it.
- Exercise the specific interaction that changed: tabs, modals, accordions, filters, form states, or redirects.
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