# Academic Events Agent Skills

Agent skills for GitHub Copilot in this repository.

## Available Skills

| Skill | Description |
|---|---|
| [api-development](api-development/) | Implement and update auth/events REST endpoints and API data flow |
| [web-frontend](web-frontend/) | Work on the SSR pages, bundled client modules, and home-page UI components |
| [docker-deployment](docker-deployment/) | Run and troubleshoot local development with Docker Compose |
| [entity-models](entity-models/) | Maintain `User`, `Event`, and MySQL-backed domain behavior |
| [debugging-operations](debugging-operations/) | Diagnose startup, runtime, API, and frontend integration issues |
| [test-first-delivery](test-first-delivery/) | Deliver behavior changes with tests when feasible and explicit validation when automation is absent |
| [skill-updater](skill-updater/) | Keep skill guides aligned with durable coding principles, structure rules, repository conventions, and instruction updates learned from tasks |

## Notes

- The attached `.github/references/` folder is a coding-style inspiration source for DOM utilities and class-based UI helpers; consult it for style cues, not for repository facts.
- This project does **not** currently include Redis, Edupage integration, i18n namespaces, or specification maintenance skills.
- This project does **not** currently include a committed automated test suite; use `test-first-delivery` to decide when to bootstrap service-local tests versus when to perform explicit manual validation.
- Skills are focused on the actual code under `api/`, `web/`, and `compose.dev.yaml`.