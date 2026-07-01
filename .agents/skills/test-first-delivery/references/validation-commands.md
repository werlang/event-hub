# Validation Commands

Use the narrowest trustworthy validation path for the touched scope.

## Verified Automated Command

### Web tests

Run this when the task changes behavior already covered by `web/tests`:

```bash
cd web
npm test
```

`web/package.json` defines `npm test`, so use the package script.

### Web bundle rebuild

Run this when the task changes `web/src/**`, webpack output expectations, Font Awesome assets, or checked-in files under `web/public/`:

```bash
docker compose -f compose.dev.yaml exec web npm run build
```

This command was verified against the running `web` service in the current Compose stack.

## Service Startup Commands

Use these when manual validation needs the services running outside Compose-managed checks.

### API

```bash
cd api
npm run development
```

Required environment for local API runs includes `JWT_SECRET`, `MYSQL_DATABASE`, and `MYSQL_ROOT_PASSWORD`.

### Web

```bash
cd web
npm run development
```

For local web runs, set `API_URL` so the browser bundle can reach the API.

### Compose stack

```bash
docker compose -f compose.dev.yaml up -d --build
```

Use this when the task depends on the repo's normal multi-service development environment.

## Manual Validation Checklist

### API changes

- Check `GET /ready`.
- Exercise affected auth routes: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` when relevant.
- Exercise affected `PUT` routes such as `PUT /auth/password`, `PUT /users/:id/promote`, `PUT /events/:id`, and `PUT /events/:id/moderation` when relevant.
- Exercise affected event routes: `GET /events`, `GET /events/:id`, `POST /events`, `DELETE /events/:id` when relevant.
- Confirm response envelopes still match the repo contract.
- If the change depends on MySQL state, mention what data or setup was required.

### Web changes

- Open the touched page or flow: `/`, `/login`, `/week`, or `/dashboard`.
- Use [browser-smoke-checklist.md](browser-smoke-checklist.md) for the maintained route-by-route browser pass before adding task-specific manual notes.
- Confirm the page renders without console-visible breakage and the targeted interaction works.
- Rebuild the web bundle when the change affects bundled assets.
- Exercise real clicks, typing, focus movement, or redirects for interaction-heavy changes instead of relying on DOM inspection alone.
- There is no committed Playwright or Cypress suite in `web/` yet, so browser validation currently means a real manual pass unless the task adds browser automation.

### Cross-service changes

- Validate both browser behavior and the underlying API response.
- Confirm auth redirects, token handling, and API integration from the affected page.
- Call out any setup that could not be reproduced locally.

## If You Bootstrap Tests In A Task

- Run the exact service-local test command added by that task.
- Keep the command local to `api/` or `web/`.
- Include the command and result in the final report.
