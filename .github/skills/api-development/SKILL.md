---
name: api-development
description: Build and maintain REST API endpoints for authentication and academic events in `api/`. Use when adding or modifying routes, request validation, auth flows, response contracts, model behavior, or datastore interactions.
---

# API Development

## Current API Shape

Base app: `api/app.js`

- `app.use('/auth', auth)`
- `app.use('/events', events)`
- global middleware: `cors()`, `express.json()`, `express.urlencoded()`

Routes:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (requires `Authorization: Bearer <token>`)
- `GET /events`
- `GET /events/:id`
- `POST /events` (requires auth)

## Data and Domain Rules

`User` model (`api/model/user.js`):

- Uses PBKDF2 password hashing (`sha256`, 310000 iterations)
- Stores per-user salt and password hash
- Normalizes email to lowercase

`Event` model (`api/model/event.js`):

- Generates UUID when `id` is missing
- Defaults: `category = 'Geral'`, `location = 'A definir'`, `audience = []`
- Sets `createdAt` automatically

Persistence (`api/helpers/datastore.js`):

- JSON file persistence in `api/data/database.json`
- Bootstraps default admin user and two sample events when file does not exist
- Filtering supported in `listEvents({ search, category, from, to, audience })`

## Authentication Pattern

Token helpers (`api/helpers/token.js`):

- `signToken(payload)`
- `verifyToken(token)`
- expiry: `12h`

Auth middleware (`api/middleware/auth.js`):

- reads bearer token from `Authorization` header
- sets `req.user` when valid
- returns `401` on missing/invalid token

## Implementation Guidance

- Keep route handlers in `api/routes/*.js`.
- Keep business/data operations in models and helpers.
- Preserve the existing JSON error format: `{ error: 'message' }`.
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

`POST /events`:
- requires `title`, `description`, `date`
- validates parsable date
- normalizes `audience` from array or comma-separated string

## References

- Read [references/route-examples.md](references/route-examples.md) when implementing or refactoring route handlers, status codes, or validation patterns.

## Out of Scope for This Repository

Do not assume the following exist (they currently do not):

- Redis caching
- Edupage/external timetable APIs
- entity expansion parameters
- proposal/check-conflicts endpoints