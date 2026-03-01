feat(web): weekly agenda UX and invite-only auth flow

Consolida a entrega EVH-1042 no frontend com experiência mobile-first para agenda
institucional, mantendo conteúdo em listagem única por categoria e links de consulta
compartilháveis por query string.

- home com dois modos: neutro sem auto-load e agenda-only por query específica
- filtros completos + chips rápidos com sincronização de URL
- login/register com registro visível, porém habilitado apenas via convite válido
- publish com data obrigatória e horário opcional por toggle explícito
- cues visuais para eventos passados e ordenação determinística no mesmo dia
  (data-only antes de data+hora)
- arquitetura modular em pages/components/helpers para manutenção evolutiva

Benefícios:
- substitui fluxo de e-mail semanal por navegação web reproduzível por link
- reduz atrito de publicação manual mantendo clareza no formulário
- preserva segurança de cadastro com convite one-time e papel de admin na emissão
- melhora legibilidade da agenda sem ocultar histórico de eventos passados
