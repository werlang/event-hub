---
name: api-development
description: Build and maintain REST API endpoints for authentication, moderation, notifications, and academic events in `api/`. Use when adding or modifying routes, request validation, auth flows, response contracts, background side effects, model behavior, or MySQL-backed persistence.
---

# API Development

## Current API Shape

Base app: `api/app.js`

- `app.use('/auth', auth)`
- `app.use('/users', users)`
- `app.use('/events', events)`
- global middleware: `cors()`, `express.json()`, `express.urlencoded()`, explicit 404 forwarding, and terminal error middleware
- readiness endpoint: `GET /ready`

Routes:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (requires `Authorization: Bearer <token>`)
- `PUT /auth/me` (requires `Authorization: Bearer <token>`)
- `PUT /auth/me/preferences` (requires `Authorization: Bearer <token>`)
- `PUT /auth/password` (requires `Authorization: Bearer <token>`)
- `POST /auth/weekly-digest/send` (requires admin bearer token)
- `POST /users/password-reset`
- `PUT /users/password-reset`
- `GET /users` (requires admin bearer token)
- `PUT /users/password/reset` (requires admin bearer token)
- `PUT /users/:id/promote` (requires admin bearer token)
- `GET /events`
- `GET /events/mine` (requires `Authorization: Bearer <token>`)
- `GET /events/moderation` (requires admin bearer token)
- `GET /events/:id`
- `POST /events` (requires auth)
- `PUT /events/:id` (requires auth)
- `DELETE /events/:id` (requires auth)
- `PUT /events/:id/moderation` (requires admin bearer token)

## Data and Domain Rules

`User` model (`api/model/user.js`):

- Uses bcrypt password hashing (`12` rounds)
- Stores password hash only (`password_hash`)
- Normalizes email to lowercase
- Normalizes roles to `admin` or `member`
- Normalizes `emailPreferences` with `eventUpdates` and `adminPendingRequests` flags enabled by default

`Event` model (`api/model/event.js`):

- Generates UUID when `id` is missing
- Normalizes category ids through `normalizeEventCategoryId(...)`, with fallback `outro`
- Defaults: `location = 'A definir'`, status `pending`
- Sets `createdAt` automatically

## Authentication Pattern

Token helpers (`api/helpers/token.js`):

- `signToken(payload)`
- `verifyToken(token)`
- expiry: `12h`

Auth middleware (`api/middleware/auth.js`):

- reads bearer token from `Authorization` header
- sets `req.user` when valid
- forwards `401` errors on missing/invalid token to centralized middleware

## Response Envelope Contract

- Success: `{ error: false, status: <code>, data: <payload>, message?: <string> }`
- Error: `{ error: true, status: <code>, type: <string>, message: <string>, data?: <any> }`

Use `sendSuccess`/`sendCreated` (`api/helpers/response.js`) for success responses and `next(error)` with `CustomError` for failures.

Error middleware (`api/middleware/error.js`) derives `type` from HTTP status names and exposes extra `data.detail` for `500` responses outside production.

## Implementation Guidance

- Keep route handlers in `api/routes/*.js`.
- Keep route handlers in `api/routes/*.js` with `try/catch` + `next(error)` orchestration.
- Keep the HTTP surface limited to `GET`, `POST`, `PUT`, and `DELETE`; model partial-update flows with `PUT` rather than introducing `PATCH`.
- Keep route-specific resource loading in the route flow itself so each endpoint makes its entity fetch and missing-resource handling explicit.
- Keep reusable auth, role, and ownership guards as Express middleware checks rather than ad hoc helper branches scattered across route handlers.
- Keep business/data operations in models/helpers and avoid writing SQL directly in route handlers.
- Use the shared base `Model` class with the `Mysql` driver instead of introducing a datastore/service wrapper layer.
- When API code needs data from another table, resolve it through `api/model/relation.js` or model composition. Do not introduce direct SQL joins in models, routes, or helpers.
- Treat raw SQL execution as an internal MySQL-driver concern. Do not expose or rely on a public `Mysql.query(...)` style API from application code.
- Treat checked-in schema files as the source of truth. Do not add runtime schema upgrade or legacy-compatibility code such as `ensureSchema`, request-time `ALTER TABLE`, `SHOW COLUMNS`, or lazy migration guards in production code.
- When route behavior includes e-mail notifications, Google Calendar publishing, or background-task side effects, keep the main HTTP outcome resilient and test the side effect orchestration with mocks instead of making route success depend on external delivery.
- Preserve the global envelope format for both success and errors.
- After each API feature or behavior change, update the Jest unit suite in `api/tests/unit` and run `docker compose -f compose.dev.yaml exec api npm run test:unit` before considering the task complete.
- Add tests for both common real-world flows and meaningful edge cases such as missing inputs, malformed identifiers, unauthorized actors, stale state, duplicate data, and fallback defaults.
- Keep API test work branch-aware: prefer assertions that cover validation failures, authorization checks, normalization, defaults, and unexpected-error wrapping, not only success paths.
- Reuse established HTTP status codes:
   - `201` for created resources
   - `400` for validation errors
   - `401` for auth errors
   - `404` for missing events
   - `409` for duplicate registration email

## Validation Rules in Existing Routes

`POST /auth/register`:
- requires `name`, `email`, `password`
- rejects duplicate email

`POST /auth/login`:
- requires `email`, `password`
- validates credentials

`PUT /auth/me`:
- requires `name`, `email`
- rejects duplicate e-mail ownership

`PUT /auth/me/preferences`:
- requires `emailPreferences`
- validates all provided flags as booleans

`PUT /auth/password`:
- requires `currentPassword`, `newPassword`
- rejects when the new password matches the current password

`PUT /users/password/reset`:
- requires `email`, `newPassword`
- only administrators may reset member passwords

`POST /events`:
- requires `title`, `description`, `date`
- validates parsable date

`PUT /events/:id`:
- requires `title`, `description`, `date`
- lets organizers update pending/rejected events and lets administrators edit any event
- resets the event to `pending` and clears `rejectionReason`

`PUT /events/:id/moderation`:
- accepts moderation status `published` or `rejected`
- `rejected` may include `rejectionReason`
- `published` may create a Google Calendar event and persist its identifiers

## References

- Read [references/route-examples.md](references/route-examples.md) when implementing or refactoring route handlers, status codes, or validation patterns.
- Use `.github/references/` as optional coding-style inspiration for helper/class ergonomics, but keep repository facts anchored in `api/` files.

## Out of Scope for This Repository

Do not assume the following exist (they currently do not):

- Redis caching
- Edupage/external APIs
- entity expansion parameters
- proposal/check-conflicts endpoints
