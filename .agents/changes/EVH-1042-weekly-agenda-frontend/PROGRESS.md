# Progress Tracker — EVH-1042

| Task | Title | Status | Owner | Updated At |
|---|---|---|---|---|
| 01 | Backend contract: convite único e tipos de usuário | ✅ Completed | Coder | 2026-03-01 |
| 02 | Refatoração frontend para pages/components/helpers | ✅ Completed | Coder | 2026-03-01 |
| 03 | Home com modos por query + filtros/chips | ⏳ Pending | - | 2026-03-01 |
| 04 | Login/register com registro por convite | ⏳ Pending | - | 2026-03-01 |
| 05 | Publicação com data padrão e horário opcional | ⏳ Pending | - | 2026-03-01 |
| 06 | Estilo mobile-first, cues de passado e ordenação | ⏳ Pending | - | 2026-03-01 |
| 07 | Wrap-up docs + 04-commit-msg + 05-gitlab-mr | ⏳ Pending | - | 2026-03-01 |

## Last Inspector Feedback
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
