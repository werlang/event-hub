# Academic Events

Academic Events is a two-service Event Hub for publishing, moderating, and sharing academic events.

- `api/`: Express 5 JSON API for auth, users, events, e-mail, Google Calendar, and background tasks.
- `web/`: Express 5 SSR web app with Mustache templates, Webpack bundles, and vanilla JS UI modules.
- `mysql`: MySQL 8.2, initialized from `api/data/schema.sql` in Docker Compose.

The API response envelope is stable:

- success: `{ error: false, status, data, message? }`
- error: `{ error: true, status, type, message, data? }`

## Quick Start

```bash
cp .env.example .env
docker compose -f compose.dev.yaml up -d --build
```

Open `http://localhost:${WEB_PORT:-80}`. The default API URL is `http://localhost:${API_PORT:-3000}`.

Useful service commands:

```bash
docker compose -f compose.dev.yaml exec api npm run test:unit
docker compose -f compose.dev.yaml exec web npm test
docker compose -f compose.dev.yaml exec web npm run build
```

## Local Scripts

API:

- `npm test`
- `npm run test:unit`
- `npm run development`
- `npm run production`

Web:

- `npm test`
- `npm run build`
- `npm run development`
- `npm run production`

## Main Routes

Web routes:

- `GET /`
- `GET /login`
- `GET /week`
- `GET /dashboard`

API route groups:

- `/auth`: register, login, current session, profile, password, preferences, and manual weekly digest.
- `/users`: self-service password reset and admin user tools.
- `/events`: public event browsing, owner events, moderation queue, event writes, and moderation decisions.

The admin user routes are under `/users`, not `/auth/users`:

- `GET /users`
- `PUT /users/password/reset`
- `PUT /users/:id/promote`

## Documentation

- [GUIDE.md](GUIDE.md): architecture, boundaries, route ownership, frontend model facades, CSS rules, and background tasks.
- [TESTING.md](TESTING.md): validation commands and when to update tests.
- [AGENTS.md](AGENTS.md): durable coding standards for future automated and human changes.
- `.agents/skills/`: project-local agent skills that mirror the current codebase.

## Configuration

Start from `.env.example`. Important defaults:

- `WEB_PORT=80`
- `API_PORT=3000`
- `MYSQL_HOST=mysql`
- `MYSQL_PORT=3306`
- `MYSQL_INTERNAL_PORT=3306`

Optional integrations:

- Google Calendar publishing uses `api/config/google-credentials.json` plus `GOOGLE_CALENDAR_ENABLED=true`.
- Weekly digest uses the background task host and `WEEKLY_DIGEST_EMAIL`.
- Database backups use `DATABASE_BACKUP_*` variables and are disabled unless `DATABASE_BACKUP_ENABLED=true`.

## Data

- Canonical schema: `api/data/schema.sql`
- Dashboard pagination sample: `api/data/dashboard-pagination-sample.sql`

Application code must not mutate schema at runtime. Update checked-in SQL artifacts for schema changes.
