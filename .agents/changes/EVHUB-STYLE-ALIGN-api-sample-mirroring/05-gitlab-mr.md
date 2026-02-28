# EVHUB-STYLE-ALIGN: API sample-style mirroring and delivery wrap-up

## Context
This MR finalizes the delivery communication layer for EVHUB-STYLE-ALIGN after the API,
web, and documentation alignment work completed in Tasks 01-06.

The implementation reviewed in this release window mirrors API architecture/style from
`api-sample/` into `api/` while preserving Academic Events behavior and JWT-only auth.

## Change Window
- Baseline reviewed: `d43713f`
- Delivery commits reviewed through: `a1bcb17`
- Inspector validation commits reviewed through: `d00a54b`

## What Changed (User-Impact First)
- API contracts are now consistent: success and error envelopes are standardized.
- Auth remains JWT-only and Bearer-based, with stronger production secret enforcement.
- Event audience persistence moved to relation-backed storage with stable
  `audience: string[]` API output.
- Web app flows (login/register/publish/list/filter) were aligned to consume the envelope
  contract without breaking expected user actions.
- Operational and contributor docs under `.github` and project docs were realigned to
  current behavior, reducing onboarding and debugging friction.

## Why This Matters
- API consumers receive predictable payloads across successful and failed requests.
- Production security posture improves by rejecting weak/missing JWT secret settings.
- Data modeling is more maintainable by normalizing audience associations.
- Future contributors and coding agents now have implementation-accurate guidance.

## Usage Notes
- No new auth mode was introduced; continue using:
  `Authorization: Bearer <token>`
- Existing route paths remain available for auth and events flows.
- Manual validation remains the repository baseline (no new automated test suite added).

## Concise Behavior Examples
- Success envelope shape:
  `{ error: false, status, data, message? }`
- Error envelope shape:
  `{ error: true, status, type, message, data? }`
- Event responses continue returning `audience` as a string array.

## Validation Executed (Strict Order)
1. `just preflight`
2. `just sct`
3. `make checks`

## Risks / Residuals
- No automated test suite is configured yet; confidence relies on command gate plus manual
  runtime verification.

## Reference
- JIRA: `EVHUB-STYLE-ALIGN`
