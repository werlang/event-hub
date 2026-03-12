---
name: docker-deployment
description: Configure and run the Academic Events API and Web services with Docker Compose in development mode. Use when starting the stack, rebuilding images, inspecting container logs, or troubleshooting compose networking, ports, and environment propagation.
---

# Docker Deployment

## Current Repository State

- Compose file in use: `compose.dev.yaml`
- Services:
  - `api` (`3000:3000`, `9229:9229`)
  - `web` (`80:80`, Webpack dev server)
  - `mysql` (`3306:3306`)
- Source directories are mounted into the containers, with named volumes for `node_modules` and MySQL data.

## Environment Variables

Expected in root `.env`:

- `NODE_ENV`
- `API_URL`
- `JWT_SECRET`
- `MYSQL_DATABASE`
- `MYSQL_ROOT_PASSWORD`

## Start / Stop

```bash
# start
docker compose -f compose.dev.yaml up -d --build

# logs
docker compose -f compose.dev.yaml logs -f api web

# status
docker compose -f compose.dev.yaml ps

# stop
docker compose -f compose.dev.yaml down
```

## Development Characteristics

- Source is mounted into containers (`./api:/app`, `./web:/app`).
- API runs with `npm run development` (`node --watch app.js`).
- Web runs with `npm run development` (`concurrently` server + webpack-dev-server).
- Dockerfiles install dependencies from each service `package.json`.
- The API container depends on `mysql`, and the web container depends on `api`.
- The MySQL service reads `MYSQL_DATABASE` and `MYSQL_ROOT_PASSWORD` from the root `.env`.

## Troubleshooting

- If dependencies look stale, rebuild images:

```bash
docker compose -f compose.dev.yaml build --no-cache api web
docker compose -f compose.dev.yaml up -d
```

- If service is not reachable, verify mapped ports and host binds in compose logs.
- If frontend cannot reach API, inspect `API_URL` handling in `web/src/js/helpers/api.js` (`resolveApiUrl()`/`requestApi()`).
- If the API cannot reach MySQL outside Docker, remember the driver defaults to host `mysql`; local non-container runs may need alternate env or host handling.