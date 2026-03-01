---
name: api-development
description: Build and maintain REST API endpoints for authentication and academic events in `api/`. Use when adding or modifying routes, request validation, auth flows, response contracts, model behavior, or datastore interactions.
---

# API Development

## Current API Shape

Base app: `api/app.js`

- `app.use('/auth', auth)`
- `app.use('/events', events)`
- global middleware: `cors()`, `express.json()`, `express.urlencoded()`, explicit 404 forwarding, and terminal error middleware
- readiness endpoint: `GET /ready`

Routes:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (requires `Authorization: Bearer <token>`)
- `GET /events`
- `GET /events/:id`
- `POST /events` (requires auth)

## Data and Domain Rules

`User` model (`api/model/user.js`):

- Uses bcrypt password hashing (`12` rounds)
- Stores password hash only (`password_hash`)
- Normalizes email to lowercase

`Event` model (`api/model/event.js`):

- Generates UUID when `id` is missing
- Defaults: `category = 'Geral'`, `location = 'A definir'`
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

## Implementation Guidance

- Keep route handlers in `api/routes/*.js`.
- Keep route handlers in `api/routes/*.js` with `try/catch` + `next(error)` orchestration.
- Keep business/data operations in models/helpers and avoid writing SQL in route/model orchestration layers.
- Preserve the global envelope format for both success and errors.
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

## References

- Read [references/route-examples.md](references/route-examples.md) when implementing or refactoring route handlers, status codes, or validation patterns.

## Out of Scope for This Repository

Do not assume the following exist (they currently do not):

- Redis caching
- Edupage/external APIs
- entity expansion parameters
- proposal/check-conflicts endpoints