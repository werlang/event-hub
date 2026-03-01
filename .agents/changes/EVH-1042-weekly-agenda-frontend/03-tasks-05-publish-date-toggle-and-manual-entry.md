## INSPECTOR FEEDBACK (Latest)

**Status**: Complete

**What Was Done**:
- Preflight obrigatório executado primeiro com fallback Docker e sucesso em `api production`, `web production` e `web dev:client` (com `webpack ... compiled successfully`).
- Revisão cética do commit `6f355bd` confirmando implementação dos módulos previstos para task 05:
  - `web/src/html/publish.html`
  - `web/src/js/pages/publish-page.js`
  - `web/src/js/components/event-form.js`
  - `web/src/js/helpers/date-serialize.js`
- Validação independente dos cenários do publish:
  - publicação com data-only: status `201`;
  - publicação com data+hora: status `201`;
  - publicação sem sessão: HTTP `401`.
- Verificação de UX na rota `/publish`: HTTP `200`, presença de toggle `Informar horário` e campo de hora desabilitado por padrão.

**What is Missing**:
- Não há pendências bloqueantes para os critérios declarados da task 05.

**What is Wrong**:
- Não foram encontrados desvios críticos de escopo/aceite na implementação da task 05.

**Next Steps for Coder**:
1. Prosseguir para task 06 preservando a separação `pages/components/helpers`.
2. Reutilizar o padrão de preflight com fallback Docker antes das próximas inspeções.
3. Na task 06, centralizar a regra de ordenação (data-only antes de horário no mesmo dia) em helper dedicado para evitar duplicação.

# Task 5: Publicação manual com data padrão e horário opcional

**Depends on**: Task 2  
**Estimated complexity**: Medium  
**Type**: Feature

## Objective
Aprimorar o formulário de publicação para entrada manual simples, com data obrigatória e horário opcional
controlado por toggle explícito.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `web/src/html/publish.html`
- `web/src/js/pages/publish-page.js`
- `web/src/js/components/event-form.js` (novo)
- `web/src/js/helpers/date-serialize.js` (novo)

## Detailed Steps
1. Update `PROGRESS.md` to mark this task as 🔄 In Progress (in the Status column).
2. Incluir toggle “Informar horário” e desabilitar campo de hora por padrão.
3. Serializar payload para enviar data-only quando toggle estiver desligado.
4. Serializar payload com data+hora quando toggle estiver ligado.
5. Manter fluxo de autenticação e mensagens de sucesso/erro do publish.
6. Run `just preflight` and fix any issues until it passes.
7. Update `PROGRESS.md` to mark this task as ✅ Completed (in the Status column).
8. Commit with a conventional commit message: `feat: implement task 05 - publish date-only and optional time`.

## Acceptance Criteria
- [ ] Data é obrigatória e horário opcional com toggle.
- [ ] Payload enviado respeita modo selecionado (com/sem horário).
- [ ] UX de publicação continua simples e clara.
- [ ] Sessão inválida continua bloqueando publicação com feedback.
- [ ] Tests pass.
- [ ] Documentation updated.

## Testing
- **Test file**: N/A (sem suíte automatizada).
- **Test cases**:
  - Publicar evento com data-only.
  - Publicar evento com data+hora.
  - Tentar publicar sem sessão válida.

## Notes
- Não incluir parser de e-mail em lote; escopo é entrada manual.
