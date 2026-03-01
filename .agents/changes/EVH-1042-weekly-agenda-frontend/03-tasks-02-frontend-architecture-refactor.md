## INSPECTOR FEEDBACK (Latest)

**Status**: Complete

**What Was Done**:
- Commit `01edb19` revisado com foco cético e aderente ao escopo da task 02.
- Arquitetura alvo confirmada: `web/src/js/index.js` como dispatcher por `page`, com orquestração em `web/src/js/pages` e reutilização em `web/src/js/components` + `web/src/js/helpers`.
- Separação de responsabilidades confirmada no diff: componentes visuais desacoplados de request/storage e consumo de API concentrado em helpers/pages.
- Preflight obrigatório executado com sucesso via fallback Docker (`api production`, `web production`, `web dev:client`).
- Validação manual independente mínima executada para `/`, `/login` e `/publish` com HTTP `200` e títulos esperados renderizados.

**What is Missing**:
- Nenhuma pendência bloqueante identificada para os critérios da task 02.

**What is Wrong**:
- Nenhum desvio crítico encontrado em relação ao objetivo e critérios declarados da task 02.

**Next Steps for Coder**:
1. Prosseguir para a task 03 respeitando dependência da task 02 já aprovada.
2. Manter `index.js` enxuto como dispatcher e evitar regressão para módulo monolítico nas próximas tasks.
3. Preservar separação `pages/components/helpers` ao implementar modos por query, filtros e chips.

# Task 2: Refatorar frontend para pages/components/helpers

**Depends on**: Task 1 (recomendado), but can start partially independent  
**Estimated complexity**: High  
**Type**: Refactoring

## Objective
Reorganizar o frontend para arquitetura modular orientada a objetos, separando orquestração de páginas,
componentes de UI e helpers não-UI, inspirado em `src-sample-1` e `src-sample-2`.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `web/src/js/index.js`
- `web/src/js/pages/home-page.js` (novo)
- `web/src/js/pages/login-page.js` (novo)
- `web/src/js/pages/publish-page.js` (novo)
- `web/src/js/components/` (novos componentes base)
- `web/src/js/helpers/` (novos utilitários de query/date/sort)

## Detailed Steps
1. Update `PROGRESS.md` to mark this task as 🔄 In Progress (in the Status column).
2. Criar camada `pages` para orquestração e manter `index.js` apenas como dispatcher por `page`.
3. Extrair blocos reutilizáveis de UI para `components` (sem lógica de API dentro do componente visual).
4. Extrair utilitários de query/date/storage/sort para `helpers`.
5. Garantir que módulos longos sejam fatiados antes de atingir ~300 linhas.
6. Validar build e inicialização das três páginas (`/`, `/login`, `/publish`).
7. Run `just preflight` and fix any issues until it passes.
8. Update `PROGRESS.md` to mark this task as ✅ Completed (in the Status column).
9. Commit with a conventional commit message: `refactor: implement task 02 - modular frontend architecture`.

## Acceptance Criteria
- [ ] Estrutura `pages/components/helpers` criada e funcional.
- [ ] `index.js` atua como dispatcher e não como módulo monolítico.
- [ ] Componentes UI desacoplados de lógica de request/storage.
- [ ] Build do web permanece funcional.
- [ ] Tests pass.
- [ ] Documentation updated.

## Testing
- **Test file**: N/A (sem suíte automatizada).
- **Test cases**:
  - Navegação para `/`, `/login`, `/publish` sem erros JS.
  - Carregamento de assets compilados após refatoração.

## Notes
- Preservar contratos existentes para reduzir risco de regressão antes dos próximos ajustes de UX.
