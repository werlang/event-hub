# Academic Events

Aplicação com dois serviços independentes, ambos em Express 5 e ES Modules, para autenticação, moderação e divulgação de eventos acadêmicos com agenda pública, dashboard autenticado, integração com Google Calendar e notificações por e-mail.

O contrato HTTP da API deste repositório usa apenas `GET`, `POST`, `PUT` e `DELETE`.

## Serviços

- **API** (`api/`, porta padrão `3000`): autenticação, moderação de eventos, integrações de e-mail/Google Calendar e tarefas em background.
- **Web** (`web/`, SSR Mustache + bundles Webpack): home pública, login/registro, agenda semanal e dashboard autenticado.

## Execução rápida

```bash
# API
cd api
npm install
PORT=3001 NODE_ENV=development MYSQL_DATABASE=academic_events MYSQL_ROOT_PASSWORD=changeme JWT_SECRET=dev-academic-events-local-secret-change-me npm run development

# Web (em outro terminal)
cd ../web
npm install
API_URL=http://localhost:3001 npm run development
```

Abra `http://localhost:80` para usar o fluxo web com o Webpack Dev Server. A agenda pública não requer autenticação; o dashboard e os envios exigem login.

Para desenvolvimento com containers, use `docker compose -f compose.dev.yaml up -d --build`.

## Testes e validação

- **API**: suíte Jest comprometida em `api/tests/unit`, executada com `cd api && npm test` ou `docker compose -f compose.dev.yaml exec api npm test -- --runInBand`.
- **Web**: suíte com Node test runner em `web/tests`, executada com `cd web && node --test tests/*.test.mjs`.
- **Bundles web**: para mudanças de frontend, regenere os assets com `docker compose -f compose.dev.yaml exec web ./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings` quando o stack Compose estiver disponível.

## Integração com Google Calendar

Quando um administrador aprova um evento em `PUT /events/:id/moderation` com `status=published`, a API pode criar automaticamente um item em um calendário compartilhado do Google e salvar o link público retornado em `calendarLink`.

Configuração necessária no ambiente da API:

- Salve o arquivo JSON da service account em `api/config/google-credentials.json`.
- O arquivo precisa conter `calendar_id`, `client_email` e `private_key`.
- Compartilhe o calendário institucional com o `client_email` do JSON com permissão para criar eventos.

The API reads only this JSON file for the Google Calendar flow; there is no environment-variable fallback for the integration.

## Tarefas em background da API

- A API inicializa tarefas em background no boot normal via `startBackgroundTasks(...)`.
- As tarefas recorrentes registradas são `weekly-email-digest`, definida em `api/background/weekly-digest-task.js`, e `database-backup`, definida em `api/background/database-backup-task.js`.
- A classe `BackgroundTask` aceita regras textuais legíveis e expressões cron.
- O digest semanal usa `WeeklyDigestManager` para ler os eventos publicados da semana atual, montar o e-mail localizado e apontar de volta para `/week` e para o link compartilhado do Google Calendar quando configurado.
- O backup de banco fica desativado por padrão. Quando `DATABASE_BACKUP_ENABLED=true`, a API executa o dump MySQL, comprime o arquivo e envia para Google Cloud Storage pela regra `DATABASE_BACKUP_RULE` (`every day at 00:00` por padrão).
- Para o backup, salve o JSON da service account em `api/config/database-backup-credentials.json` ou ajuste `DATABASE_BACKUP_GCLOUD_ACCOUNT_FILE`. O projeto, bucket e pasta de destino vêm de `DATABASE_BACKUP_GCLOUD_PROJECT_ID`, `DATABASE_BACKUP_GCLOUD_BUCKET` e `DATABASE_BACKUP_GCLOUD_STORAGE_DIR`.
- Fora de produção, o scheduler só executa callbacks quando `EMAIL_TESTING=true`; caso contrário, ele apenas registra em log os disparos ignorados.

## Fluxos principais

- **Home (`/`)**: renderiza a agenda pública com filtros de busca/categoria/período, paginação e chips rápidos. Por padrão, a listagem usa a semana local atual; quando a URL já traz filtros, a página entra em modo agenda-only e oculta as superfícies de entrada.
- **Login/Register (`/login`)**: alterna entre abas, preserva o redirect sanitizado, envia login/registro ao backend, persiste o token localmente e redireciona para o dashboard.
- **Agenda semanal (`/week`)**: página pública dedicada à semana atual (domingo a sábado), com CTA destacado para o Google Calendar compartilhado e paginação própria.
- **Dashboard (`/dashboard`)**: área autenticada com abas para seus envios, moderação e configurações. O painel de configurações cobre perfil, senha, preferências de e-mail e, para admins, reset de senha e promoção de usuários.
- **Autenticação (API)**:
  - `POST /auth/register` exige `name`, `email` e `password`, e retorna token JWT (12h) + usuário.
  - `POST /auth/login` retorna token JWT (12h) + usuário.
  - `GET /auth/me` retorna a sessão atual.
  - `PUT /auth/me` atualiza `name` e `email` da conta autenticada e devolve token renovado.
  - `PUT /auth/me/preferences` atualiza as preferências de e-mail da conta autenticada.
  - `PUT /auth/password` atualiza a senha da conta autenticada.
  - `GET /auth/users` lista usuários para ferramentas administrativas.
  - `PUT /auth/users/password/reset` redefine a senha de uma conta `member` a partir do e-mail informado por um administrador.
  - `PUT /auth/users/:id/promote` promove uma conta `member` para `admin`.
- **Eventos (API)**:
  - `POST /events` (Bearer token) cria um evento e o envia para moderação.
  - `GET /events` lista apenas eventos publicados com filtros `search|q`, `category`, `from`, `to`, retornando também `organizerName`.
  - `GET /events/:id` retorna o detalhe público de um evento publicado.
  - `GET /events/mine` (Bearer token) lista os eventos da conta autenticada.
  - `PUT /events/:id` (Bearer token) permite ao organizador reenviar eventos pendentes/rejeitados e também permite edição administrativa, recolocando o evento em `pending`.
  - `DELETE /events/:id` (Bearer token) permite exclusão do organizador em estados gerenciáveis e exclusão administrativa em qualquer estado.
  - `GET /events/moderation` (Bearer token admin) lista a fila administrativa com filtro opcional `status=pending|rejected`.
  - `PUT /events/:id/moderation` (Bearer token admin) aprova ou rejeita eventos pendentes, podendo criar o item correspondente no Google Calendar.
- **Notificações por e-mail**:
  - admins opt-in recebem aviso quando um evento entra na fila de moderação.
  - organizadores opt-in recebem avisos quando admins atualizam, excluem, aprovam ou rejeitam seus eventos.
  - o digest semanal envia a agenda pública da semana para a audiência resolvida pelo manager.

## Exemplos de links compartilháveis

- Agenda semanal (Domingo→Sábado):
  - `/?from=2026-03-01&to=2026-03-07`
- Agenda semanal por categoria:
  - `/?from=2026-03-01&to=2026-03-07&category=Pesquisa`
- Busca textual com recorte de período:
  - `/?search=edital&from=2026-03-01&to=2026-03-31`

## Contrato de resposta

- **Sucesso**: `{ error: false, status, data, message? }`
- **Erro**: `{ error: true, status, type, message, data? }`

## Dados e seeds

- O schema oficial do banco está em `api/data/schema.sql` (tabelas `users` e `events`).
- O repositório não possui bootstrap automático nem seeds executados pela API atual; o banco precisa estar provisionado separadamente.
- Mudanças de schema devem ser feitas nesses arquivos versionados antes do deploy. A aplicação não deve tentar atualizar tabelas em runtime nem carregar compatibilidade para versões antigas do banco durante as requisições.
- Para demonstrar a paginação do dashboard com mais de 10 eventos em uma única conta, use `api/data/dashboard-pagination-sample.sql`.
  Após importar o arquivo, entre com `membro.paginacao@example.com` e senha `senha123456` para ver 12 eventos no dashboard e acionar a paginação.
- Para desenvolvimento via Docker Compose, use `compose.dev.yaml`, que sobe `api`, `web` e `mysql`.

## Variáveis de ambiente relevantes

- `NODE_ENV`, `PORT`
- `API_URL`, `WEB_URL`
- `JWT_SECRET`
- `MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD`
- `GOOGLE_CALENDAR_JOIN_URL`
- `WEEKLY_DIGEST_EMAIL`
- `EMAIL_TESTING`
- `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `DATABASE_BACKUP_ENABLED`, `DATABASE_BACKUP_RULE`
- `DATABASE_BACKUP_GCLOUD_PROJECT_ID`, `DATABASE_BACKUP_GCLOUD_BUCKET`, `DATABASE_BACKUP_GCLOUD_STORAGE_DIR`, `DATABASE_BACKUP_GCLOUD_ACCOUNT_FILE`

## Roles

- `POST /auth/register` é aberto e cria contas diretamente com papel padrão `member`.
- Usuários têm `role` persistido (`admin` ou `member`), incluído no payload do JWT e nas respostas de autenticação.

## Convenções de código

- ES Modules, Express 5, classes para modelos (`api/model/`), rotas puras em `api/routes/`.
- Em endpoints da API, autenticação, autorização e checagens de ownership/papel devem ficar em middlewares Express reutilizáveis. O carregamento do recurso da rota deve permanecer no próprio fluxo da rota, para deixar explícito como cada endpoint busca e trata sua entidade.
- JWT via `helpers/token.js`; persistência MySQL com helper/driver em `api/helpers/mysql.js` e base `Model` em `api/model/model.js`.
- Quando um modelo da API precisar buscar dados de outra tabela, a composição deve passar por `api/model/relation.js`; não introduza joins SQL diretos no código de aplicação.
- Documentação em código: toda função nomeada, método, getter/setter e helper reutilizável deve receber bloco JSDoc. Callbacks anônimos curtos podem permanecer sem bloco quando forem apenas detalhe local de implementação, mas handlers inline de rota/middleware devem ser documentados imediatamente acima do registro.
- Cada arquivo e módulo deve ter uma responsabilidade principal clara. Quando o contrato principal de um arquivo for uma classe, helpers reutilizáveis devem ficar em módulos auxiliares dedicados.
- Mudanças novas devem priorizar legibilidade e extensibilidade: nomes descritivos, métodos curtos, fluxo explícito e reaproveitamento das abstrações já existentes antes de criar novos desvios condicionais.
- Refatorações devem reduzir acoplamento e arquivos inchados, separando responsabilidades por contexto, papel de usuário ou componente quando a complexidade crescer.
- UI SSR com Mustache + assets estáticos em `web/public/` (`css` e `js`).
- A pasta `.github/references/` existe como fonte de inspiração para estilo de código em helpers e componentes DOM; use-a como referência de ergonomia, não como documentação do runtime atual.

## Critérios de manutenção

- Toda tarefa nova deve buscar manter ou melhorar a clareza da arquitetura existente.
- Antes de adicionar comportamento a arquivos grandes, avalie se a melhor solução é extrair colaboradores menores e mais coesos.
- Prefira composição entre classes, componentes e helpers a concentrar múltiplas responsabilidades em uma única implementação.
- Considere a facilidade de leitura e evolução futura como parte do critério de pronto, não apenas o funcionamento imediato.

## Arquitetura frontend (web/src/js)

- `index.js`: entry da home pública, responsável por filtros, chips, paginação, modo agenda-only e renderização de eventos.
- `login.js`: entry da página de login, responsável pelo fluxo de autenticação e redirect pós-login.
- `week.js`: entry da agenda semanal pública, responsável pela leitura do intervalo SSR, carregamento dos eventos da semana e paginação dedicada.
- `dashboard.js`: entry da área autenticada, responsável por sessão, abas de navegação, listagens, modais e configurações da conta.
- `dashboard/*.js`: controladores de UI específicos do dashboard, incluindo criação/edição de evento, rejeição, filtros e painéis de configuração.
- `components/*`: blocos de UI reutilizáveis, como `EventList`, `FilterForm`, `QuickChips`, `Pagination`, `Tooltip`, `Toast`, `Header` e `Form`.
- `helpers/*`: utilitários não-UI para request, template vars, query state, datas, sessão e ordenação.
- `public/html/*.html`: fragmentos HTML estáticos consumidos por modais do dashboard com substituição segura de placeholders `{{token}}`.

## Ícones e assets visuais

- Font Awesome é a biblioteca de ícones usada no web app e é carregada globalmente pelo bundle via `web/src/css/base.css`.
- Botões, chips, cards, modais e ações do dashboard devem preservar texto visível em um `<span>` e usar o ícone apenas como apoio visual, para manter alinhamento e acessibilidade.
- A dependência fica declarada em `web/package.json`, e o build da web gera também os arquivos de fonte em `web/public/assets/fonts/`.
- Sempre que houver mudança no bundle da web ou em assets do Font Awesome, regenere os arquivos públicos com o mesmo fluxo do projeto, por exemplo: `docker compose -f compose.dev.yaml exec web ./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings`.
