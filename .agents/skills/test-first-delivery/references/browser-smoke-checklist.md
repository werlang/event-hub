# Browser Smoke Checklist

Use this checklist when a frontend task changes real user input, focus, tabs, modals, filters, redirects, or auth-gated flows and you need one repeatable browser pass that future agents can follow without adding Playwright or Cypress.

This is the maintained manual browser path for this repository. Run the existing automated web suite first, then use this checklist to cover the interaction branches that `web/tests` and bundle checks do not fully replace.

## Baseline Before Opening The Browser

1. Start the repo in its normal development shape.

   ```bash
   docker compose -f compose.dev.yaml up -d --build
   ```

   If you are running locally instead of Compose, use the API and web startup commands from [validation-commands.md](validation-commands.md).

2. Run the committed automated web suite first.

   ```bash
   cd web
   npm test
   ```

3. If the task changed bundled assets, rebuild them before the browser pass.

   ```bash
   docker compose -f compose.dev.yaml exec web npm run build
   ```

4. When using Compose, open `http://localhost:80` in the browser.

## Data And Account Prerequisites

- Public route smoke on `/` and `/week` is strongest when the database has at least one published event in the current week. If the environment has no published data, verify the documented empty states instead of forcing seeded fixtures.
- Member dashboard smoke needs one valid member account. If none exists, create a disposable one through `/login` using the public register flow.
- To validate the `Mostrar eventos passados` branch itself, prefer a member account that already owns hidden historical events. A fresh disposable registration with zero events is still valid for the rest of the member smoke path, but it should stay on the default no-events empty state.
- Admin dashboard smoke needs one real admin account. The repository does not seed admins automatically, so use an existing admin or promote one outside this checklist.
- Optional dashboard pagination smoke can use [../../../../api/data/dashboard-pagination-sample.sql](../../../../api/data/dashboard-pagination-sample.sql). The current documented login is `membro.paginacao@example.com` with password `senha123456`; see the root [../../../../README.md](../../../../README.md) data notes.
- Admin reset, promote, and manual-digest actions mutate accounts or can send e-mail. Run those only in a disposable or explicitly safe testing environment.

## Recommended Member Smoke Path

### `/`

- Open `/`.
- Expect the hero, filter form, event grid shell, and pagination container to render without obvious console or runtime breakage.
- Confirm `De` and `Até` are prefilled with the current local week.
- Type a value into `Busca`, choose one `Categoria`, adjust `De` and `Até`, and submit `Aplicar filtros`.
- Expect the page to stay on `/`, fetch `/events` with the chosen filters, and refresh the visible list without a full-page reload.
- If the filters match events, confirm the cards update. If they do not, confirm the home flow shows its no-results feedback instead of failing silently.
- Click at least one quick chip such as `Hoje`, `Esta semana`, `Próximos 7 dias`, or `Todos Próximos`.
- Expect the date controls to update and the list to reload.
- Load one query-driven URL directly, for example `/?search=mostra&category=extensao&from=2026-04-08&to=2026-04-10`.
- Expect the filter controls to hydrate from the query string and the hero/filter entry surfaces to hide in agenda-only mode.
- Current behavior note: the home page reads query state on load, but applying filters does not rewrite the location bar. Do not treat missing URL updates after submit as a regression unless the task explicitly changed that contract.

### `/login`

- Open `/login`.
- Switch between `Entrar` and `Registrar`.
- Expect the visible form to swap and the `#register` hash to appear only while the register tab is active.
- On `Registrar`, submit mismatched passwords.
- Expect the toast `A confirmação de senha não confere.` and focus to remain on the confirmation field.
- Perform one successful auth action.
- Preferred repeatable path: log in with an existing member account.
- Fallback disposable path: register a new member account.
- Expect a success toast such as `Login realizado com sucesso.` or `Conta criada com sucesso. Redirecionando...`, followed by navigation to `/dashboard`.

### `/week`

- Open `/week`.
- Expect the SSR week-range label to render and the `Google Agenda` button to be present.
- If the current week has approved events, confirm the list renders without authentication.
- If the current week has no approved events, confirm the empty state `Nenhum evento aprovado está programado para esta semana.`.
- If there are more than 10 approved events in the visible week, use the week paginator and confirm the visible slice changes without leaving the page.
- Click the `Google Agenda` link and confirm it opens the configured calendar URL in a new tab when `GOOGLE_CALENDAR_JOIN_URL` is configured.

### `/dashboard` as member

- Land on `/dashboard` from the successful login or registration flow.
- Expect the role chip to resolve to `Membro`, the `Moderar envios` action tab to stay hidden, and the default view to show `Seus envios`.
- In the browse list, identify which member-data case you are validating before using `Mostrar eventos passados`.
- Fresh disposable member with zero events: expect the default empty state `Você ainda não enviou nenhum evento. Use o botão Novo Evento no topo para criar o primeiro.` to remain before and after toggling `Mostrar eventos passados`.
- Member with hidden historical events: toggle `Mostrar eventos passados` and expect the list to expand or the empty-state guidance to change. If every owned event is historical, the default browse state should first show `Não há eventos futuros ou em andamento agora. Marque a opção para incluir eventos passados na lista.` and that guidance should stop appearing after the toggle.
- Click `Configurações`, then return to `Seus envios`.
- Expect the settings section to open, then the browse sections to return without a full page reload.
- Click `Novo evento`.
- First submit the modal with the required fields left blank.
- Expect `Preencha título, descrição e data antes de enviar o evento.`.
- Reopen the modal, fill `Título`, `Descrição`, and `Data`, then submit.
- Expect a success toast such as `Evento enviado para aprovação com sucesso.` or the API success message, and confirm the new event appears in the member list with pending status.
- In `Configurações`, toggle `Atualizações dos seus eventos`, save, confirm the success toast, then revert the toggle so the account returns to its original preference state.
- Avoid password changes during the routine smoke pass unless you are using a disposable account.

## Optional Admin Extension

Use this only when the task touched moderation or admin settings and a real admin account plus disposable data are available.

### `/dashboard` as admin

- Sign in with an admin account and open `/dashboard`.
- Expect the role chip to resolve to `Administrador` and the `Moderar envios` action tab to be visible.
- Click `Moderar envios`.
- Expect the moderation view to load the pending queue.
- If you created one member event in the member smoke pass, approve that event from the queue.
- Expect the approve button to show `Aprovando...`, a success toast such as `Evento aprovado e publicado.` or the API success message, and the approved card to disappear from the queue.
- Change `Exibir` from `Fila de revisão` to `Rejeitados` and then `Publicados`.
- Expect the list source to change and those discovery views to expose only edit/delete actions for events from other accounts.
- Open `Configurações > Ferramentas admin` only in a disposable environment.
- `Redefinir senha`: expect a success toast and the submit button to leave its busy state.
- `Promover usuário`: expect a success toast and the target account to gain admin access.
- `Enviar email`: expect a success toast and remember that this request posts the browser time zone and may send a real message.

## What To Record In The Task Report

- Which routes were opened: `/`, `/login`, `/week`, and `/dashboard`.
- Whether the pass covered member-only smoke or both member and admin paths.
- Whether `/` and `/week` were checked in populated or empty-state mode.
- Any skipped admin-only or e-mail-sending steps and why.
- Any setup used, such as a fresh registration, an externally promoted admin, or the dashboard pagination sample dataset.
