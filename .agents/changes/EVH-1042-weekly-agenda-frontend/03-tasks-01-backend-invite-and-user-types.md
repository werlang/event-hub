## INSPECTOR FEEDBACK (Latest)

**Status**: Incomplete - Requires rework

**What Was Done**:
- Artefatos da tarefa, especificação, plano e progresso foram revisados e a tarefa 01 estava marcada como concluída.

**What is Missing**:
- Execução bem-sucedida do preflight obrigatório (`just preflight` fallback) com evidência de passing.
- Evidência de validação manual dos cenários exigidos após preflight bem-sucedido.

**What is Wrong**:
- Preflight gate falhou no passo 1: `cd api && npm run production` retornou `zsh: command not found: npm` (exit 127).
- Pelo protocolo da tarefa, qualquer falha de preflight torna a tarefa incompleta por definição.

**Next Steps for Coder**:
1. Focus on: garantir ambiente/comandos de preflight executáveis e obter sucesso em todos os passos do protocolo.
2. Verify: registrar evidências de execução sem erro para `api production`, `web production` e `web dev:client`.
3. Ensure: somente após preflight passing, revalidar os critérios de aceite e documentar verificação manual dos fluxos exigidos.

# Task 1: Backend contract de convite único e tipos de usuário

**Depends on**: None  
**Estimated complexity**: High  
**Type**: Feature

## Objective
Habilitar base de autenticação por convite one-time e tipos de usuário, permitindo que somente admins
gerem convites para registro.

## ⚠️ Important information
Before coding, Read FIRST -> Load [03-tasks-00-READBEFORE.md](03-tasks-00-READBEFORE.md)

## Files to Modify/Create
- `api/data/schema.sql`
- `api/model/user.js`
- `api/model/model.js` (se necessário para suporte a nova entidade)
- `api/model/invite.js` (novo, se adotado)
- `api/routes/auth.js`
- `api/middleware/auth.js`
- `README.md`

## Detailed Steps
1. Update `PROGRESS.md` to mark this task as 🔄 In Progress (in the Status column).
2. Adicionar suporte a tipo de usuário (`role`) no usuário, preservando compatibilidade com usuários atuais.
3. Definir persistência de convite com token único, expiração e marcação de uso.
4. Ajustar `POST /auth/register` para exigir token de convite válido e inutilizar convite após uso.
5. Criar endpoint admin para geração de convite (one-time link), protegido por role admin.
6. Padronizar respostas no envelope de erro/sucesso já utilizado na API.
7. Validar manualmente fluxo: convite inválido, expirado, usado, válido; geração por admin e bloqueio para não-admin.
8. Run `just preflight` and fix any issues until it passes.
9. Update `PROGRESS.md` to mark this task as ✅ Completed (in the Status column).
10. Commit with a conventional commit message: `feat: implement task 01 - invite and user roles contract`.

## Acceptance Criteria
- [ ] Usuários possuem tipo/role persistido.
- [ ] Registro sem convite falha de forma explícita.
- [ ] Registro com convite válido cria conta e invalida o convite.
- [ ] Apenas admin consegue gerar convite.
- [ ] Contrato de resposta da API permanece consistente.
- [ ] Tests pass.
- [ ] Documentation updated.

## Testing
- **Test file**: N/A (sem suíte automatizada).
- **Test cases**:
  - Registro sem token de convite.
  - Registro com token inválido/expirado/utilizado.
  - Registro com token válido.
  - Geração de convite com usuário admin e com usuário não-admin.

## Notes
- Se `just preflight` não existir, aplicar protocolo alternativo descrito em
  `03-tasks-00-READBEFORE.md`.
- Rework (2026-03-01): preflight validado via Docker (`api production`, `web production`, `web dev:client`) com boot/build sem erro.
- Rework (2026-03-01): cenários manuais confirmados com envelopes corretos — sem convite (400), convite inválido (400), válido (201), usado (409), expirado (410), geração por admin (201) e bloqueio de não-admin (403).
