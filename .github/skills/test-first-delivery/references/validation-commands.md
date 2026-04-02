# Validation Commands

Use the narrowest trustworthy validation path for the touched scope.

## Verified Automated Command

### Web bundle rebuild

Run this when the task changes `web/src/**`, webpack output expectations, Font Awesome assets, or checked-in files under `web/public/`:

```bash
docker compose -f compose.dev.yaml exec web ./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings
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
- Exercise affected event routes: `GET /events`, `GET /events/:id`, `POST /events` when relevant.
- Confirm response envelopes still match the repo contract.
- If the change depends on MySQL state, mention what data or setup was required.

### Web changes

- Open the touched page or flow: `/`, `/login`, `/dashboard`, or `/publish`.
- Confirm the page renders without console-visible breakage and the targeted interaction works.
- Rebuild the web bundle when the change affects bundled assets.
- Remember that `/publish` still has no dedicated client bundle; validate only the SSR shell unless the task adds one.

### Cross-service changes

- Validate both browser behavior and the underlying API response.
- Confirm auth redirects, token handling, and API integration from the affected page.
- Call out any setup that could not be reproduced locally.

## If You Bootstrap Tests In A Task

- Run the exact service-local test command added by that task.
- Keep the command local to `api/` or `web/`.
- Include the command and result in the final report, because this repo does not have a pre-existing standard test script yet.
