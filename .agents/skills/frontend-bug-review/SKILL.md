---
name: frontend-bug-review
description: Deeply review the Academic Events frontend in `web/` for SSR and template contract mismatches, interaction regressions, query-state bugs, auth and redirect defects, date/time issues, accessibility gaps, and missing regression coverage. Use when auditing frontend code, reviewing UI bugs, or pairing findings with deterministic `web/tests` updates and browser validation.
---

# Frontend Bug Review

Use this skill for skeptical frontend review work in `web/` when the goal is to find real user-facing defects, prove them, and lock them down with regression coverage plus honest browser validation.

## Required Pairing

Always pair this skill with [../test-first-delivery/SKILL.md](../test-first-delivery/SKILL.md) and [../web-frontend/SKILL.md](../web-frontend/SKILL.md).

This skill finds likely defects.
`test-first-delivery` supplies the contract for updating `web/tests`, rebuilding bundles, and reporting validation.
`web-frontend` supplies page architecture, route ownership, and client/API integration rules.

## Focus Areas

Prioritize defects that can change user behavior, UI state, submitted data, or the rendered shell:

- SSR template variables and route-to-bundle wiring in `web/app.js`, `web/middleware/render.js`, and `web/src/html/*.html`
- query-state hydration, URL sync, filter defaults, chips, pagination, and shareable links
- login/register redirects, token persistence, auth-gated dashboard boot, and role-conditioned surfaces
- modal, tab, form, toast, and dashboard action state transitions
- date/time normalization between `datetime-local` inputs, ISO payloads, local week ranges, and rendered labels
- empty, loading, busy, error, and retry states around API responses and local UI actions
- accessibility regressions around focus, hidden states, labels, button disabling, and keyboard-driven flows
- checked-in bundle or shared CSS contract drift when HTML, CSS, or entry wiring changes

Do not spend the review on style-only feedback or speculative redesigns without a concrete behavior, accessibility, or maintainability risk.

## Review Workflow

1. Scope the affected page or module: `index`, `login`, `week`, `dashboard`, shared components/helpers, SSR template, or bundle entry.
2. Read the production code and the nearest `web/tests/*.test.mjs` coverage first.
3. Map the user-visible flow from SSR shell to client boot to API request/response handling.
4. Look for contract mismatches between HTML ids/classes, JS selectors, template vars, route output, and checked-in bundles.
5. Decide whether each likely bug fits a pure helper assertion, a `jsdom` plus VM workflow test, a spawned route test, or needs a real browser pass.
6. Add or update focused tests under `web/tests` when a deterministic assertion is possible.
7. Rebuild the affected web bundle when assets or entrypoints changed.
8. Exercise the changed flow in a real browser session when the bug depends on real input, focus, responsive layout, storage, redirects, or authenticated multi-step behavior, using [../test-first-delivery/references/browser-smoke-checklist.md](../test-first-delivery/references/browser-smoke-checklist.md) as the default route-level smoke pass.
9. Report findings ordered by severity, then list any browser-only or cross-service gaps that remain.

## Test Selection Heuristics

- Use pure helper and contract tests for query parsing, filter normalization, formatting, sorting, permission helpers, and route/template invariants.
- Use `jsdom` plus VM entrypoint tests for page boot, DOM mutations, modal wiring, tab behavior, submit order, and storage-aware client logic.
- Use spawned Express route checks for SSR rendering, template variables, static bundle inclusion, and page-shell contracts.
- Use manual browser validation when behavior depends on actual clicks, typing, focus timing, CSS/layout, localStorage or sessionStorage persistence, redirects, or authenticated cross-service flows.

## Bug Heuristics

Prefer investigating these patterns early:

- HTML ids, classes, or data hooks changed without matching JS selector or test updates
- filters or pagination that change the UI without round-tripping the URL or preserving defaults
- auth flows that trust an unsafe redirect target or rely on stale token state
- `datetime-local` values submitted without ISO normalization or rendered with time-zone drift
- busy or error states that disable controls before reading values, never recover on failure, or hide the real message
- hidden or admin-only dashboard surfaces that rely on CSS alone instead of boot-time logic
- bundle or stylesheet changes that update source files without verifying the checked-in `web/public` artifacts when the repo expects them
- tests that assert markup exists but never prove the interaction branch, empty state, or failure path that can regress

## Output Expectations

When the user asked for a review, findings come first.

Each finding should include:

- severity
- the affected frontend file or user flow
- why it is a real bug or likely runtime defect
- whether deterministic `web/tests` coverage exists or was added
- whether a browser pass is still needed

Keep summaries brief. The value of this skill is in concrete frontend bug finding plus executable regression coverage.