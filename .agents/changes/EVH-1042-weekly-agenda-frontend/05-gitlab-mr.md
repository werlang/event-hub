# EVH-1042 — Agenda semanal web + cadastro por convite

## Contexto
Esta MR finaliza a mudança do fluxo institucional de comunicação semanal para uma
experiência web unificada. A home passa a operar com estado reproduzível por URL,
autenticação com convite e publicação manual simplificada.

## Escopo entregue
- Home com modo neutro (sem eventos por padrão) e modo agenda-only por query.
- Filtros por busca/categoria/período com chips rápidos e URL compartilhável.
- Login/register com registro visível, desabilitado sem convite válido.
- Sessão refletida na interface e redirect pós-login para publicação.
- Publish com data obrigatória e horário opcional por toggle.
- Ordenação de agenda com prioridade para data-only no mesmo dia.
- Cues visuais para eventos passados mantendo itens na listagem.
- Refactor frontend modular (`pages`, `components`, `helpers`).

## Como usar
1. Acesse `/` sem query para modo neutro.
2. Acesse `/?from=2026-03-01&to=2026-03-07` para agenda semanal compartilhável.
3. Acesse `/login` para autenticar; registro só habilita com `inviteToken` válido.
4. Após login, publique em `/publish` com data-only ou data+hora.

## Impacto para usuário final
- Consulta da agenda institucional por link direto sem ruído de entrada.
- Cadastro protegido por convite one-time, sem registro público aberto.
- Publicação mais simples e previsível para conteúdo sem horário definido.
- Leitura de histórico preservada com sinalização visual de eventos passados.

## Validação
- Preflight obrigatório executado (fallback Docker): API/Web production e Web dev client.
- Smoke final manual:
  - Home `/` e home com query retornando `200`.
  - Login sem e com `inviteToken` retornando `200`.
  - Publish acessível e com toggle de horário presente.

## Observações
- Não há suíte automatizada no repositório; validação desta entrega é manual.
- Contratos de resposta da API foram preservados (envelope de sucesso/erro).
