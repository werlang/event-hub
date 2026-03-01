## INSPECTOR FEEDBACK (Latest)

**Status**: Complete

**What Was Done**:
- Preflight obrigatório executado primeiro com fallback Docker e sucesso em `api production`, `web production` e `web dev:client` (com `webpack ... compiled successfully`).
- Revisão cética do commit `43e0afc` confirmando implementação dos artefatos previstos para task 06:
  - `web/src/js/helpers/event-sort.js`
  - `web/src/js/components/event-list.js`
  - `web/src/js/components/event-card.js`
  - `web/src/css/index.css`
- Validação independente dos critérios centrais da task:
  - ordenação no mesmo dia priorizando `data-only` antes de `data+hora`: `Sem horário > Com horário > Dia seguinte`;
  - classificação de passado confirmada (`past_flag=true`);
  - cue visual confirmado no card (`has_past_class=true`, `has_past_label=true`).
- Smoke de navegação para os modos impactados da home com HTTP `200` em `/` e `/?from=2026-03-01&to=2026-03-07`.

**What is Missing**:
- Não há pendências bloqueantes para os critérios declarados da task 06.

**What is Wrong**:
- Não foram encontrados desvios críticos de escopo/aceite na implementação da task 06.

**Next Steps for Coder**:
1. Prosseguir para task 07 (wrap-up) consolidando documentação final e material de MR.
2. Preservar o mesmo protocolo de preflight obrigatório com fallback Docker na rodada final.
3. Manter a regra de ordenação centralizada em helper para evitar regressões em futuras alterações de listagem.

# Task 6: Cues visuais de passado, ordenação e polimento mobile-first

**Depends on**: Task 3, Task 5  
**Estimated complexity**: Medium  
**Type**: Feature

## Objective
Aplicar tratamento visual simples para eventos passados, garantir ordenação correta (data-only antes de
horários no mesmo dia) e finalizar responsividade mobile-first.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `web/src/css/index.css`
- `web/src/js/components/event-card.js`
- `web/src/js/helpers/event-sort.js` (novo)
- `web/src/js/components/event-list.js`

## Detailed Steps
1. Update `PROGRESS.md` to mark this task as 🔄 In Progress (in the Status column).
2. Criar helper de ordenação centralizado para aplicar regra de data-only antes de horários no mesmo dia.
3. Aplicar classe/estado para eventos passados (opacidade, fundo e legibilidade equilibrados).
4. Ajustar layout para mobile-first mantendo simplicidade visual.
5. Verificar consistência da listagem em home normal e agenda por query.
6. Run `just preflight` and fix any issues until it passes.
7. Update `PROGRESS.md` to mark this task as ✅ Completed (in the Status column).
8. Commit with a conventional commit message: `feat: implement task 06 - past-event cues sort and responsive polish`.

## Acceptance Criteria
- [ ] Eventos passados permanecem visíveis com cue visual claro.
- [ ] Ordenação respeita regra de data-only antes de eventos com horário no mesmo dia.
- [ ] Responsividade mobile-first adequada nas páginas impactadas.
- [ ] Tests pass.
- [ ] Documentation updated.

## Testing
- **Test file**: N/A (sem suíte automatizada).
- **Test cases**:
  - Listagem contendo passado/futuro.
  - Mesmo dia com evento sem horário e com horário.
  - Verificação em viewport móvel e desktop.

## Notes
- Evitar excessos visuais; manter abordagem minimalista solicitada.
