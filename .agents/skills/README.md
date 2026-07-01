# Academic Events Agent Skills

Agent skills for GitHub Copilot in this repository.

## Available Skills

| Skill | Description |
|---|---|
| [api-development](api-development/) | Implement and update auth/events REST endpoints and API data flow |
| [web-frontend](web-frontend/) | Work on the SSR pages, bundled client modules, and the home, week, login, and dashboard surfaces |
| [frontend-bug-review](frontend-bug-review/) | Review `web/` skeptically for UI, interaction, SSR, auth-flow, and coverage regressions |
| [docker-deployment](docker-deployment/) | Run and troubleshoot local development with Docker Compose |
| [entity-models](entity-models/) | Maintain `User`, `Event`, and MySQL-backed domain behavior |
| [debugging-operations](debugging-operations/) | Diagnose startup, runtime, API, and frontend integration issues |
| [test-first-delivery](test-first-delivery/) | Deliver behavior changes with the existing API and web test suites, plus explicit browser/manual validation when browser-only checks are still needed |
| [api-bug-review](api-bug-review/) | Review `api/` skeptically for real bugs and pair findings with deterministic API regression tests |
| [skill-updater](skill-updater/) | Keep README, skill guides, prompts, and Copilot instructions aligned with durable conventions and current codebase behavior |
| [documentation-maintenance](documentation-maintenance/) | Keep README, GUIDE, TESTING, AGENTS, prompts, and local skills synchronized with implementation changes |
| [document-touched-code](document-touched-code/) | Add focused JSDoc or comments for touched reusable code without narrating obvious statements |

## Notes

- The attached `.github/references/` folder is a coding-style inspiration source for DOM utilities and class-based UI helpers; consult it for style cues, not for repository facts.
- This project does **not** currently include Redis, Edupage integration, or i18n namespaces.
- This project already includes committed automated coverage in `api/tests/unit` and `web/tests`; use `test-first-delivery` to decide when to extend those suites versus when to add explicit manual validation.
- This project does **not** currently ship a committed Playwright or Cypress suite under `web/`; browser validation means a real manual browser pass unless a task explicitly adds browser automation.
- Use `frontend-bug-review` for skeptical review of `web/` flows and `api-bug-review` for skeptical review of `api/` flows.
- Skills are focused on the actual code under `api/`, `web/`, and `compose.dev.yaml`.
- Admin user routes live under `/users`, not `/auth/users`.
- Frontend endpoint strings belong in `web/src/js/model/`.
- Source CSS uses mobile-first `min-width` breakpoints: `640px`, `768px`, `1024px`, `1280px`, `1536px`.
