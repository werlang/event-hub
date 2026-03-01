---
name: debugging-operations
description: Diagnose runtime and integration issues across API and Web services in this Academic Events project. Use when services fail to boot, auth or event flows break, API responses are unexpected, frontend rendering is incorrect, or Docker development behavior is unstable.
---

# Debugging and Operations

## Service Topology

- API: Express service in `api/` (default internal port `3000`)
- Web: Express + Webpack dev server in `web/`
- Dev compose file: `compose.dev.yaml`

## Fast Health Checks

```bash
# containers
docker compose -f compose.dev.yaml ps

# logs
docker compose -f compose.dev.yaml logs --tail=100 api
docker compose -f compose.dev.yaml logs --tail=100 web

# API routes
curl http://localhost:3000/ready
curl http://localhost:3000/events
curl http://localhost:3000/auth/me -H "Authorization: Bearer <token>"
```

## Auth Flow Debugging

1. Register user:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"123456"}'
```

2. Login user:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

3. Validate token:

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <token>"
```

## Event Flow Debugging

Create event:

```bash
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Workshop","description":"Descrição","date":"2026-03-10T19:00:00.000Z"}'
```

Filter events:

```bash
curl "http://localhost:3000/events?search=workshop&category=Geral"
```

## Common Failure Points

- Calling protected endpoints without bearer token returns `401` with envelope error payload.
- Missing/invalid `JWT_SECRET` causes token mismatch between services/restarts.
- Missing `Authorization: Bearer` prefix returns `401`.
- Invalid `date` payload in `POST /events` returns `400`.
- Frontend API base URL may be empty if template `apiUrl` or `<meta name="api-url">` is not set.

## Envelope Checks

- Success payload shape: `{ error: false, status, data, message? }`
- Error payload shape: `{ error: true, status, type, message, data? }`
- If payload shape diverges, inspect route helper usage (`sendSuccess`, `sendCreated`) and error forwarding (`next(error)`).

## Useful Files During Debugging

- `api/app.js`
- `api/routes/auth.js`
- `api/routes/events.js`
- `api/middleware/auth.js`
- `web/app.js`
- `web/src/js/index.js`
- `compose.dev.yaml`