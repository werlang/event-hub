# Project Guidelines

## Code Style
- **ES Modules only**: use `import`/`export` (`"type": "module"` in both services).
- **Express 5**: API and Web both run on Express `^5.2.1`.
- **Model classes**: domain logic is implemented in classes under `api/model/`.
- **Routes as functions**: route handlers live in `api/routes/*.js`.
- **Private class fields**: prefer `#field` / `#method` where state should be encapsulated.

## Architecture
- **API service** (`api/`): REST endpoints for auth and events.
- **Web service** (`web/`): SSR shell with Mustache and client behavior bundled with Webpack.
- **No shared package**: `api/` and `web/` are independent Node projects.
- **Persistence**: MySQL datastore managed by `DataStore` + model/driver classes (`api/helpers/mysql.js`, `api/model/*.js`).

## API Overview
- Base middleware in `api/app.js`: `cors()`, JSON/urlencoded parsing, readiness route (`GET /ready`), explicit 404 forwarding, and terminal error middleware.
- Registered route groups:
  - `app.use('/auth', auth)`
  - `app.use('/events', events)`

### Response contract
- Success envelope: `{ error: false, status, data, message? }`
- Error envelope: `{ error: true, status, type, message, data? }`

### Auth routes (`api/routes/auth.js`)
- `POST /auth/register` → create user and return JWT.
- `POST /auth/login` → validate credentials and return JWT.
- `GET /auth/me` → requires Bearer token via `authMiddleware`.

### Event routes (`api/routes/events.js`)
- `GET /events` → public list with filters: `search|q`, `category`, `from`, `to`, `audience`.
- `GET /events/:id` → public event detail.
- `POST /events` → authenticated event creation.

## Auth and Security
- JWT helpers are in `api/helpers/token.js`.
- Default JWT expiry is `12h`.
- `JWT_SECRET` comes from env, with a local fallback for development.
- In production, `JWT_SECRET` is mandatory and must be at least 32 chars (weak/common secrets are rejected).
- API auth is Bearer-token based (`Authorization: Bearer <token>`).

## Data Model Conventions
- **User** (`api/model/user.js`):
  - password hashing via bcrypt (`12` rounds).
  - email normalized to lowercase.
- **Event** (`api/model/event.js`):
  - generated UUID when `id` is absent.
  - defaults: `category = 'Geral'`, `location = 'A definir'`, `audience = []`.
  - audience persistence is relation-backed via `event_audiences` (`audience: string[]` in API output).
  - `createdAt` set automatically when omitted.

## Build and Run
- **API scripts**:
  - `npm run production` → `node app.js`
  - `npm run development` → `node --watch app.js`
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
- There is no production `compose.yaml` in this repository at the moment.

## Frontend Notes
- Web entry route: `GET /` renders `web/src/html/index.html`.
- Static assets are served from `web/public/`.
- Client entry is `web/src/js/index.js` and dispatches by page:
  - `web/src/js/login.js` handles login/register flows,
  - `web/src/js/publish.js` handles authenticated event publishing,
  - `web/src/js/index.js` handles public event filtering/list rendering.

## Environment Variables
- Root `.env` currently contains:
  - `NODE_ENV`
  - `API_URL`
  - `JWT_SECRET`
  - `MYSQL_DATABASE`
  - `MYSQL_ROOT_PASSWORD`

## Testing
- No automated test suite is currently configured.
- Validate changes with manual API/Web checks and (when relevant) Docker Compose logs.