# Project Guidelines

## Code Style
- **ES Modules only**: use `import`/`export` (`"type": "module"` in both services).
- **Express 5**: API and Web both run on Express `^5.2.1`.
- **Model classes**: domain logic is implemented in classes under `api/model/`.
- **Routes as functions**: route handlers live in `api/routes/*.js`.
- **API route guards as middleware**: auth, ownership, and role checks for API endpoints should be implemented as Express middleware in `api/middleware/` or companion middleware modules. Resource loading should stay in the route flow so each endpoint owns how it fetches and handles its entities.
- **HTTP methods**: keep the API contract limited to `GET`, `POST`, `PUT`, and `DELETE`. Do not introduce `PATCH` routes.
- **In-code documentation**: every named function, method, getter/setter, and reusable local helper must have a JSDoc block. Short anonymous callbacks may stay undocumented when they are clearly local implementation details, but inline route or middleware handlers must be documented directly above the registration call.
- **Private class fields**: prefer `#field` / `#method` where state should be encapsulated.
- **Related behavior in classes**: prefer small focused classes that unify related behavior over scattering the same domain logic across standalone helper exports.
- **Single responsibility first**: keep files, classes, and helpers focused on one primary job. When a file exists to export a class, move reusable standalone helpers into companion modules instead of mixing multiple responsibilities in the same file.
- **Prefer direct code over tiny helpers**: do not extract 1-2 line functions when the call site stays clearer and the helper does not materially improve reuse, testability, or maintainability.
- **Readable over clever**: prefer descriptive names, small methods, guard clauses, explicit data flow, and predictable public APIs over compact but opaque implementations.
- **Scalable structure**: extend existing abstractions or compose smaller collaborators before adding more branching to bloated modules, controllers, or UI entrypoints.
- **Cross-table data loading**: when API code needs related records from another table, compose that through `api/model/relation.js`. Do not add direct SQL joins in models or expose a public raw-query method from the MySQL driver.

## Architecture
- **API service** (`api/`): REST endpoints for auth and events, plus e-mail notifications, Google Calendar publishing, and recurring background tasks.
- **Web service** (`web/`): SSR shell with Mustache and client behavior bundled with Webpack.
- **No shared package**: `api/` and `web/` are independent Node projects.
- **Persistence**: MySQL access flows through the base `Model` class and the `Mysql` driver (`api/model/model.js`, `api/helpers/mysql.js`).
- **Relations**: cross-table lookups and relation-style data loading should flow through `api/model/relation.js` instead of ad hoc joins in model code.

## Implementation Expectations
- Future tasks should preserve or improve maintainability, scalability, and ease of understanding.
- Refactors should reduce coupling or file bloat, not merely relocate code without clarifying responsibilities.
- Prefer extracting role-specific or concern-specific collaborators when flows start diverging instead of accumulating conditionals in a single class or module.
- In the API layer, keep route modules clear about data flow: load route-specific entities inside the route logic, then apply reusable middleware-style checks for authorization and ownership.
- When the project already has a reusable UI or DOM interaction pattern, follow that pattern rather than introducing one-off implementations that are harder to maintain.
- Runtime compatibility for old database schemas is not allowed in application code. When a feature needs schema changes, update the checked-in SQL/bootstrap artifacts and assume the running software is already on the current schema version.
- Do not add runtime schema mutation or legacy upgrade logic such as `ensureSchema`, `SHOW COLUMNS`, `ALTER TABLE`, lazy migration flags, or request-time fallback migrations inside models, routes, helpers, or boot paths.

## API Overview
- Base middleware in `api/app.js`: `cors()`, JSON/urlencoded parsing, readiness route (`GET /ready`), explicit 404 forwarding, and terminal error middleware.
- Registered route groups:
  - `app.use('/auth', auth)`
  - `app.use('/events', events)`

### Response contract
- Success envelope: `{ error: false, status, data, message? }`
- Error envelope: `{ error: true, status, type, message, data? }`

### Auth routes (`api/routes/auth.js`)
- `POST /auth/register` → create user and return JWT; no invite token is required.
- `POST /auth/login` → validate credentials and return JWT.
- `GET /auth/me` → requires Bearer token via `authMiddleware`.
- `PUT /auth/me` → authenticated profile update that returns a refreshed JWT.
- `PUT /auth/me/preferences` → authenticated e-mail preference update.
- `PUT /auth/password` → authenticated password change.
- `GET /auth/users` → authenticated admin-only user list.
- `PUT /auth/users/password/reset` → authenticated admin-only password reset for member accounts.
- `PUT /auth/users/:id/promote` → authenticated admin-only promotion flow.

### Event routes (`api/routes/events.js`)
- `GET /events` → public list with filters: `search|q`, `category`, `from`, `to`.
- `GET /events/mine` → authenticated organizer event list.
- `GET /events/moderation` → authenticated admin moderation queue, with optional `status=pending|rejected`.
- `GET /events/:id` → public event detail.
- `POST /events` → authenticated event creation.
- `PUT /events/:id` → organizer resubmission for pending/rejected events and admin edits that return the event to moderation.
- `DELETE /events/:id` → organizer deletion for pending/rejected events and admin deletion for any event.
- `PUT /events/:id/moderation` → admin-only moderation decision for pending events, including Google Calendar publication on approval.

## Auth and Security
- JWT helpers are in `api/helpers/token.js`.
- Default JWT expiry is `12h`.
- `JWT_SECRET` must be present in the environment before the API starts.
- API auth is Bearer-token based (`Authorization: Bearer <token>`).

## Data Model Conventions
- **User** (`api/model/user.js`):
  - password hashing via bcrypt (`12` rounds).
  - email normalized to lowercase.
  - roles normalized to `admin` or `member`.
  - e-mail preference flags normalized through `emailPreferences` with defaults enabled.
- **Event** (`api/model/event.js`):
  - generated UUID when `id` is absent.
  - category ids normalized through `normalizeEventCategoryId(...)`, with fallback `outro`.
  - defaults: `location = 'A definir'`, status `pending`.
  - `createdAt` set automatically when omitted.

## Build and Run
- **API scripts**:
  - `npm run production` → `node app.js`
  - `npm run development` → `node --inspect=0.0.0.0 --watch app.js`
- **Web scripts**:
  - `npm run production` → `node app.js`
  - `npm run development` → `concurrently "npm run dev:server" "npm run dev:client"`
  - `npm run dev:server` → `node --inspect=0.0.0.0 --watch app.js`
  - `npm run dev:client` → `webpack serve`

## Docker (Current Repo State)
- Development orchestration is in `compose.dev.yaml`.
- Services currently configured:
  - `api` (port `3000`, inspector `9229`)
  - `web` (Webpack dev server on port `80`)
  - `mysql` (port `3306`)
- The compose file mounts source code into the containers and runs each service in development mode.

## Frontend Notes
- Web routes:
  - `GET /` renders `web/src/html/index.html`
  - `GET /login` renders `web/src/html/login.html`
  - `GET /week` renders `web/src/html/week.html`
  - `GET /dashboard` renders `web/src/html/dashboard.html`
- Static assets are served from `web/public/`.
- Webpack entries are:
  - `web/src/js/index.js` → public home page bundle plus shared `index.css`
  - `web/src/js/login.js` → login/register tab UI plus `login.css`
  - `web/src/js/week.js` → public week-page bundle plus `week.css`
  - `web/src/js/dashboard.js` → authenticated dashboard bundle plus `dashboard.css`
- The current home page flow is componentized around `EventList`, `FilterForm`, `QuickChips`, `Pagination`, and `Header`, and defaults to the current local week range.
- The current week page is a dedicated public route that reads SSR-provided date bounds and the shared Google Calendar join URL.
- The dashboard is organized around `DashboardActionTabs`, event-management modals, reusable filters, and `DashboardSettingsPanels` for profile, password, e-mail preferences, and admin account tools.
- `web/src/js/helpers/template-var.js` reads server-injected template variables from `web/middleware/render.js`.
- `web/src/js/helpers/api.js` resolves API URLs from template vars, then a meta tag, then relative paths.
- The `.github/references/` folder is a style inspiration source for class-based DOM helpers and component ergonomics; use it as reference material, not as a copy target.

## Environment Variables
- Relevant root/Compose environment variables include:
  - `NODE_ENV`
  - `API_URL`
  - `WEB_URL`
  - `JWT_SECRET`
  - `MYSQL_DATABASE`
  - `MYSQL_ROOT_PASSWORD`
  - `GOOGLE_CALENDAR_JOIN_URL`
  - `WEEKLY_DIGEST_EMAIL`
  - `EMAIL_TESTING`
  - `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`

## Testing
- API automation lives in the committed Jest unit suite under `api/tests/unit`.
- Web automation lives in the committed Node test suite under `web/tests`.
- Feature and refactor work is not complete after code edits alone: when a task introduces or touches stable automation, update and run it.
- Prefer `docker compose -f compose.dev.yaml exec api npm test -- --runInBand` for the full API unit suite when the Compose stack is available.
- Prefer `cd web && node --test tests/*.test.mjs` for the committed web route/template/contract suite.
- When automation is still absent for the touched flow, validate changes with explicit manual API/Web checks and, when relevant, Docker Compose logs.
- Prefer the smallest service-local test bootstrap when a task can add deterministic coverage cleanly inside `api/` or `web/`; otherwise document the manual validation steps and remaining gaps.
- For web asset or bundle changes, prefer the repository workflow `docker compose -f compose.dev.yaml exec web ./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings` when the Compose stack is available.