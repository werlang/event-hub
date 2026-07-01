# Event Hub Guide

## Architecture

This repository keeps the API and Web services independent.

```text
browser page script -> web frontend models -> API routes -> API models -> Mysql helper -> MySQL
```

- `api/app.js` owns API middleware, route registration, readiness, 404, and error handling.
- `api/routes/` owns HTTP route flow and request validation.
- `api/model/` owns persistence-facing entity behavior.
- `api/helpers/mysql.js` is the only place that builds SQL.
- `web/app.js` owns SSR routes, static files, and render middleware.
- `web/src/html/` owns Mustache page templates.
- `web/src/js/model/` owns frontend API endpoint paths.
- `web/src/js/components/` owns reusable DOM components.
- `web/src/js/dashboard/` owns dashboard-specific UI collaborators.
- `web/src/css/` owns tokens, base styles, page entry styles, and scoped component partials.

## API Boundaries

Registered route groups:

- `app.use('/auth', auth)`
- `app.use('/users', users)`
- `app.use('/events', events)`

Keep the public route surface stable unless a task explicitly changes the API contract.

Auth routes:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `PUT /auth/me`
- `PUT /auth/me/preferences`
- `PUT /auth/password`
- `POST /auth/weekly-digest/send`

User routes:

- `POST /users/password-reset`
- `PUT /users/password-reset`
- `GET /users`
- `PUT /users/password/reset`
- `PUT /users/:id/promote`

Event routes:

- `GET /events`
- `GET /events/:id`
- `GET /events/mine`
- `GET /events/moderation`
- `POST /events`
- `PUT /events/:id`
- `DELETE /events/:id`
- `PUT /events/:id/moderation`

Use only `GET`, `POST`, `PUT`, and `DELETE`.

## API Implementation Rules

- Keep auth, role, and ownership checks in middleware where reusable.
- Keep route-specific resource loading in the route flow so each endpoint remains explicit.
- Keep model behavior in model classes; do not put SQL in routes.
- Use `api/model/relation.js` for cross-table composition instead of ad hoc joins.
- Do not expose a public raw-query helper from `Mysql`.
- Do not add runtime schema migration, `SHOW COLUMNS`, lazy `ALTER TABLE`, or legacy compatibility branches.
- Preserve response envelopes and HTTP status semantics.
- Keep external side effects, such as e-mail and Google Calendar, resilient and covered with mocks.

## MySQL Helper

`api/helpers/mysql.js` owns SQL construction and exposes CRUD-shaped methods:

- `find`, `findOne`, `get`
- `insert`, `upsert`, `update`, `delete`
- `withTransaction`, `resetTables`, `dump`
- filter helpers such as `like`, `between`, `ne`, `lt`, `gt`, `lte`, and `gte`

Models should call these methods instead of constructing SQL fragments.

## Web Render Contract

`web/middleware/render.js` adds `res.templateRender(view, vars)`.

- It merges fixed and route-scoped template vars.
- It removes only `undefined` values.
- It preserves valid falsy values such as `false`, `0`, and `''`.
- It embeds client-readable vars through `<script id="template-vars" type="application/json">` using escaped JSON.

Browser code reads these values through `TemplateVar`.

## Frontend API Calls

Frontend endpoint paths belong in `web/src/js/model/`.

- `model/auth.js`: login, register, session, profile, password, preferences, weekly digest, token storage.
- `model/users.js`: password reset and admin user tools.
- `model/events.js`: public events, owner events, moderation, creates, updates, deletes.

Page entries and dashboard modules should call these facades instead of hard-coding endpoint strings.

## CSS Standards

- Page CSS entry files import `tokens.css` and `base.css` first, then component partials.
- Keep global tokens in `web/src/css/tokens.css`, and keep them primitive-only: fonts, colors, radii, and the shared spacing scale.
- Keep shared element defaults in `web/src/css/base.css`.
- Component partials must stay scoped to their component class names.
- Use mobile-first media queries only.
- Allowed breakpoints are `640px`, `768px`, `1024px`, `1280px`, and `1536px`.
- Do not add `max-width` media queries.
- Preserve the current warm visual theme unless the task is explicitly a redesign.

## Background Tasks

The API starts background work through the background task host, not cron files or route-triggered loops.

Current tasks:

- `weekly-email-digest`
- `database-backup`

Database backups stay disabled unless `DATABASE_BACKUP_ENABLED=true`.

## Compose

Use the standalone dev compose file for local work:

```bash
docker compose -f compose.dev.yaml up -d --build
```

`compose.dev.yaml` runs explicit development commands and exposes configurable local ports. `compose.yaml` runs production commands and preserves the `agenda` network.
