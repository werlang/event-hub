# Testing

Run validation from the repository root unless noted.

## Compose Validation

```bash
docker compose -f compose.dev.yaml config
docker compose -f compose.dev.yaml up -d --build
```

## API

```bash
docker compose -f compose.dev.yaml exec api npm run test:unit
```

Service-local equivalent:

```bash
cd api
npm run test:unit
```

The API suite is Jest under `api/tests/unit`.

## Web

```bash
docker compose -f compose.dev.yaml exec web npm test
docker compose -f compose.dev.yaml exec web npm run build
```

Service-local equivalents:

```bash
cd web
npm test
npm run build
```

The web suite uses the Node test runner under `web/tests`.

## When To Add Tests

- Add focused API tests when changing route behavior, model behavior, auth/role/ownership checks, background side effects, or MySQL helper behavior.
- Add focused web tests when changing SSR vars, frontend API facades, DOM rendering, dashboard interactions, auth redirects, CSS contracts, or bundle entry behavior.
- For CSS architecture changes, include a targeted search or contract test when a convention is easy to regress.
- For browser-only behavior without automation, record the exact manual route and interaction used.

## Bundle Rule

When changing `web/src/js` or `web/src/css`, regenerate checked-in `web/public` bundles with:

```bash
docker compose -f compose.dev.yaml exec web npm run build
```

## Static Checks

Useful responsive CSS contract check:

```bash
rg -n -P "@media \\(max-width|@media \\(min-width: (?!640px|768px|1024px|1280px|1536px)" web/src/css -g '*.css'
```

No output means the source CSS follows the breakpoint rule.
