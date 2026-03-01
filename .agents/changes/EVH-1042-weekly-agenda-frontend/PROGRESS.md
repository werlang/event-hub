# Progress Tracker — EVH-1042

| Task | Title | Status | Owner | Updated At |
|---|---|---|---|---|
| 01 | Backend contract: convite único e tipos de usuário | ✅ Completed | Coder | 2026-03-01 |
| 02 | Refatoração frontend para pages/components/helpers | ✅ Completed | Inspector | 2026-03-01 |
| 03 | Home com modos por query + filtros/chips | ✅ Completed | Inspector | 2026-03-01 |
| 04 | Login/register com registro por convite | ✅ Completed | Inspector | 2026-03-01 |
| 05 | Publicação com data padrão e horário opcional | ✅ Completed | Coder | 2026-03-01 |
| 06 | Estilo mobile-first, cues de passado e ordenação | ⏳ Pending | - | 2026-03-01 |
| 07 | Wrap-up docs + 04-commit-msg + 05-gitlab-mr | ⏳ Pending | - | 2026-03-01 |

## Last Inspector Feedback
- 2026-03-01: Task 04 aprovada pelo inspector após preflight obrigatório (fallback Docker), revisão cética do commit `0acd5b2` e validação independente da tela `/login` (sem e com `inviteToken`) com HTTP `200` e marcadores de UX esperados.
- 2026-03-01: Task 03 aprovada pelo inspector após preflight obrigatório (fallback Docker), revisão cética dos módulos de home/query/chips e smoke checks HTTP independentes via container (`home=200`, `home_query=200`, `events_query=200`).
- 2026-03-01: Task 02 aprovada após revalidação completa do inspector (preflight obrigatório passing via Docker + revisão cética do commit `01edb19` + checagem manual de `/`, `/login` e `/publish` com HTTP `200`).
- 2026-03-01: Task 02 marcada como incompleta por bloqueio no preflight obrigatório na inspeção atual (ambiente do inspector sem `docker`, `npm` e `node`), impedindo validação independente do gate.
- 2026-03-01: Task 01 marcada como incompleta por falha no preflight obrigatório (`npm run production` em `api/` retornou `command not found: npm`). Pelo protocolo, nenhuma validação adicional substitui preflight com falha.

## Rework Validation Evidence (2026-03-01)
- Preflight executado em ambiente Docker (não host) com sucesso:
	- `docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'` → `Academic Events API running on http://0.0.0.0:3100`.
	- `docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'` → `Academic Events Web running on http://0.0.0.0:3200`.
	- `docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 12; kill $pid; wait $pid || true'` → `webpack ... compiled successfully`.
- Validação manual de cenários de convite/auth concluída:
	- Registro sem convite: HTTP `400`.
	- Registro com token inválido: HTTP `400`.
	- Registro com token válido: HTTP `201` e criação de usuário com `role`.
	- Reuso do mesmo convite: HTTP `409`.
	- Convite expirado (expiração forçada no banco para teste): HTTP `410`.
	- Geração de convite por admin: HTTP `201`.
	- Tentativa de gerar convite com usuário `member`: HTTP `403`.

## Inspector Re-review (2026-03-01)
- **Status**: ✅ Complete (Task 01 approved).
- **Preflight gate**: Aprovado em ambiente válido (Docker), com sucesso em `api production`, `web production` e `web dev:client`.
- **Validação manual independente**: fluxo confirmado novamente com os códigos esperados — sem convite (`400`), convite inválido (`400`), convite válido (`201`), reuso (`409`), convite expirado (`410`), geração por admin (`201`) e bloqueio para não-admin (`403`).
- **Conclusão de qualidade**: critérios de aceite da task 01 atendidos; pendências do feedback anterior (falha de preflight) resolvidas.

## Task 02 Validation Evidence (2026-03-01)
- Refatoração implementada com dispatcher em `web/src/js/index.js` e nova estrutura em `web/src/js/pages`, `web/src/js/components` e `web/src/js/helpers`.
- Preflight (fallback Docker) executado com sucesso:
	- `docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'`
	- `docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'`
	- `docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 12; kill $pid; wait $pid || true'`
- Verificação manual do fluxo alterado:
	- Navegação para `/`, `/login` e `/publish` confirmada em ambiente local durante validação funcional.
	- Build de assets concluído sem erros (`webpack ... compiled successfully`).

## Inspector Re-review Task 02 (2026-03-01)
- **Status**: ✅ Complete (Task 02 approved).
- **Revisão de código (cética)**: commit `01edb19` confirma dispatcher em `web/src/js/index.js`, estrutura modular em `pages/components/helpers` e desacoplamento básico entre UI e request.
- **Preflight gate**: aprovado pelo inspector com sucesso em ambiente Docker usando caminho absoluto do binário:
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'`
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'`
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 12; kill $pid; wait $pid || true'`
- **Validação manual independente**: rotas web `/`, `/login` e `/publish` responderam HTTP `200` e renderizaram títulos esperados.
- **Conclusão de qualidade**: critérios de aceite da task 02 atendidos nesta rodada de inspeção.

## Task 03 Validation Evidence (2026-03-01)
- Implementado modo por query na home com regra centralizada em `query-state` (`hasSpecificHomeQuery`):
	- Sem query relevante: não busca eventos automaticamente e mantém superfícies de entrada visíveis.
	- Com query relevante: executa busca inicial e oculta superfícies de entrada (`hero`, auth da topbar e bloco de filtros/chips).
- Filtros e chips rápidos sincronizados com query string compartilhável (busca, categoria, de/até, esta semana, próximos 7 dias, categorias-chave).
- Helper de semana local Domingo→Sábado criado e validado (`week-range`).
- Preflight obrigatório executado com fallback Docker (host sem `npm/node/docker` no `PATH`):
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 5; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 12; kill $pid; wait $pid || true'`.
- Smoke checks executados:
	- `GET /` e `GET /?from=2026-03-01&to=2026-03-07&category=Pesquisa` retornando HTTP `200`.
	- Execução de helpers em Node validando: modo sem query `false`, modo com query `true`, serialização de filtros e intervalo semanal `2026-03-01` → `2026-03-07`.

## Inspector Re-review Task 03 (2026-03-01)
- **Status**: ✅ Complete (Task 03 approved).
- **Preflight gate**: aprovado em fallback Docker com evidências:
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 8; kill $pid; wait $pid || true'`.
	- Evidência de `webpack ... compiled successfully` coletada em `/usr/local/bin/docker compose -f compose.dev.yaml logs --tail=80 web`.
- **Revisão de código (cética)**: regra de modo por query centralizada em `query-state` (`hasSpecificHomeQuery`), home neutra sem auto-fetch em `home-page`, filtros/chips sincronizando URL, helper `week-range` com semana local Domingo→Sábado.
- **Validação manual independente**: checks HTTP via Node no container `web` retornaram `home=200`, `home_query=200` e `events_query=200`; helper checks confirmaram `modeDefault=false`, `modeQuery=true`, serialização de filtros e faixa semanal `2026-03-01` → `2026-03-07`.
- **Conclusão de qualidade**: critérios de aceite da task 03 atendidos nesta rodada de inspeção.

## Task 04 Validation Evidence (2026-03-01)
- Implementação concluída para login/register por convite em frontend:
	- Registro visível e desabilitado por padrão em `web/src/html/login.html`.
	- Componente `AuthTabs` com estado bloqueado/habilitado para aba de registro.
	- Novo helper `invite-token` para leitura/validação preliminar via query (`inviteToken|invite|token`).
	- `login-page` com mensagens claras para convite ausente/inválido/expirado/usado e bloqueio de registro nesses cenários.
	- `SessionBadge` adicionado e integrado ao topo para refletir estado de sessão.
	- Redirecionamento pós-login preservado para `/publish`.
- Preflight obrigatório executado via fallback Docker (host sem `npm`):
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 14; kill $pid; wait $pid || true'` com `webpack ... compiled successfully`.
- Verificações manuais/smoke:
	- `GET /login` sem convite retornando HTTP `200`.
	- Convite válido gerado via API (`POST /auth/login` admin + `POST /auth/invites`) e abertura de `/login?inviteToken=<token>` retornando HTTP `200`.
	- Asserções de template e source dentro do container `web` confirmando:
		- aba de registro desabilitada por padrão,
		- presença de campo oculto `inviteToken`,
		- presença de `session-badge`,
		- fallback de redirect para `/publish` no `login-page`.

## Inspector Re-review Task 04 (2026-03-01)
- **Status**: ✅ Complete (Task 04 approved).
- **Preflight gate**: aprovado com fallback Docker:
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 14; kill $pid; wait $pid || true'`.
- **Revisão de código (cética)**: commit `0acd5b2` cobre os artefatos esperados da task (`login.html`, `login-page`, `auth-tabs`, `session-badge`, `invite-token`) e mantém redirect pós-login para `/publish`.
- **Validação independente**:
	- `GET /login` e `GET /login?inviteToken=<token>` com HTTP `200`.
	- Marcadores da UX no HTML de `/login`: `tab--disabled=true`, `hidden_invite_token=true`, `session_badge=true`, `invite_hint=true`, `redirect_publish=true`.
	- Convite válido emitido via API com fluxo admin (`POST /auth/login` + `POST /auth/invites`) para teste da URL com token.
- **Observação operacional**: em modo desenvolvimento, foi necessário reiniciar o serviço `web` para invalidar cache de template e refletir o HTML atualizado durante a inspeção.

## Task 05 Validation Evidence (2026-03-01)
- Implementação concluída para publicação com data obrigatória e horário opcional:
	- `web/src/html/publish.html` atualizado com toggle `Informar horário` e campo de hora desabilitado por padrão.
	- `web/src/js/components/event-form.js` criado para controlar estado do toggle, validação e serialização do payload.
	- `web/src/js/helpers/date-serialize.js` criado para compor `date` em modo data-only (`YYYY-MM-DD`) ou data+hora (`YYYY-MM-DDTHH:mm`).
	- `web/src/js/pages/publish-page.js` ajustado para usar o novo componente mantendo gate de sessão e mensagens de sucesso/erro.
- Preflight obrigatório executado com fallback Docker e sucesso:
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3100 api sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps -e PORT=3200 web sh -lc 'npm run production & pid=$!; sleep 6; kill $pid; wait $pid || true'`.
	- `/usr/local/bin/docker compose -f compose.dev.yaml run --rm --no-deps web sh -lc 'npm run dev:client & pid=$!; sleep 14; kill $pid; wait $pid || true'` com `webpack ... compiled successfully`.
- Verificações manuais/smoke concluídas:
	- Publicar com data-only: HTTP `201`.
	- Publicar com data+hora: HTTP `201`.
	- Tentar publicar sem sessão válida: HTTP `401`.
	- `GET /publish`: HTTP `200`, `has_toggle=true`, `time_disabled_default=true`.
