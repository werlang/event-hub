docs(shared): finalize EVHUB-STYLE-ALIGN delivery artifacts

JIRA: EVHUB-STYLE-ALIGN

Publish final release communication artifacts for the API sample-style mirroring rollout.
This captures user-impact outcomes from auth/events/API envelope alignment, web client
compatibility updates, and documentation realignment for future maintenance.

Change window reviewed: d43713f..a1bcb17 (plus inspector validations on top).

User impact:
- API responses are now consistently envelope-based across auth and events endpoints.
- JWT auth remains Bearer/JWT-only with stronger production secret policy.
- Event audiences are relation-backed while preserving audience arrays in API payloads.
- Web login/register/publish/list flows consume the new contract without UX regressions.
- Project docs and skills now describe the current implementation and troubleshooting paths.
