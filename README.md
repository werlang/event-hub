# Academic Events

Aplicação com dois serviços independentes, ambos em Express 5 e ES Modules, para autenticação, e publicação de eventos acadêmicos com visualização pública e filtros.

O contrato HTTP da API deste repositório usa apenas `GET`, `POST`, `PUT` e `DELETE`.

## Serviços

- **API** (`api/`, porta padrão `3000`): autenticação, cadastro e listagem filtrada de eventos.
- **Web** (`web/`, porta padrão `3000` local no processo; exposta como `80` no Compose): interface SSR Mustache para login/registro, publicação e exploração pública dos eventos.

## Execução rápida

```bash
# API
cd api
npm install
NODE_ENV=development MYSQL_DATABASE=academic_events MYSQL_ROOT_PASSWORD=changeme JWT_SECRET=dev-academic-events-local-secret-change-me npm run development

# Web (em outro terminal)
cd ../web
npm install
API_URL=http://localhost:3000 npm run development
```

Abra `http://localhost:80` (Compose) ou `http://localhost:3000` (execução local direta da web) para usar. A agenda pública não requer autenticação; o cadastro de eventos exige login.

Para desenvolvimento com containers, use `docker compose -f compose.dev.yaml up -d --build`.

## Integração com Google Calendar

Quando um administrador aprova um evento em `PUT /events/:id/moderation` com `status=published`, a API pode criar automaticamente um item em um calendário compartilhado do Google e salvar o link público retornado em `calendarLink`.

Configuração necessária no ambiente da API:

- Salve o arquivo JSON da service account em `api/config/google-credentials.json`.
- O arquivo precisa conter `calendar_id`, `client_email` e `private_key`.
- Compartilhe o calendário institucional com o `client_email` do JSON com permissão para criar eventos.

The API reads only this JSON file for the Google Calendar flow; there is no environment-variable fallback for the integration.

## Tarefas em background da API

- A API instancia tarefas em background diretamente no boot normal da aplicação, sem um módulo de bootstrap separado.
- A primeira tarefa recorrente é `weekly-sunday-foo`, criada com uma regra textual como `every sunday at 18:00` e executada no relógio local do processo.
- A classe `BackgroundTask` também aceita expressões cron quando for mais conveniente do que a regra textual.
- Em produção, o callback configurado em `api/background/foo.js` será executado a cada ocorrência.
- Fora de produção, a infraestrutura recalcula os próximos disparos, mas apenas registra em log quando a tarefa chegaria ao horário configurado.

## Fluxos principais

- **Páginas web**: `/` opera em dois modos (neutro sem carregar eventos por padrão, ou agenda-only quando acessada com query de filtro); `/login` renderiza a troca visual entre abas de entrada e registro; `/publish` renderiza o formulário de publicação.
- **Dashboard (`/dashboard`)**: área autenticada que resume os seus envios, lista eventos da própria conta e abre ações rápidas por modais com templates HTML estáticos pré-carregados e argumentos de template aplicados na abertura.
- **Home (`/`)**: filtros por busca/categoria/período e chips rápidos (esta semana, próximos 7 dias e categorias) sincronizam a URL para compartilhamento de estado.
- **Home em modo agenda-only por link**: ao acessar `/` com query relevante (`search|q`, `category`, `from`, `to`), a tela prioriza apenas os resultados da agenda e oculta superfícies de entrada.
- **Autenticação**:
  - `POST /auth/register` exige `name`, `email` e `password`, e retorna token JWT (12h) + usuário.
  - `POST /auth/login` retorna token JWT (12h) + usuário.
  - `GET /auth/me` retorna sessão atual (incluindo `role`).
  - `PUT /auth/me` atualiza `name` e `email` da conta autenticada e retorna o usuário com token renovado.
  - `PUT /auth/password` atualiza a senha da conta autenticada.
  - `GET /auth/users` lista usuários para ferramentas administrativas.
  - `PUT /auth/users/password/reset` redefine a senha de uma conta `member` a partir do e-mail informado por um administrador.
  - `PUT /auth/users/:id/promote` promove uma conta `member` para `admin`.
- **Login/Register (`/login`)**: a interface alterna entre abas, sincroniza `#register` na URL, envia login/registro ao backend, persiste o token localmente e redireciona após autenticar.
- **Publicação (`/publish`)**: a página SSR já contém o formulário e o toggle de horário, mas o repositório ainda não possui um bundle dedicado para validar sessão e enviar o formulário.
- **Eventos (API)**:
  - `POST /events` (Bearer token) — cria evento com `title`, `description`, `date`, `category`, `location`.
  - `GET /events` — lista pública com filtros `search|q`, `category`, `from`, `to`, retornando também `organizerName`.
  - `GET /events/:id` — detalhe público.
  - `GET /events/mine` (Bearer token) — lista os eventos da conta autenticada.
  - `PUT /events/:id` (Bearer token) — atualiza um evento pendente ou rejeitado e o reenfileira para moderação.
  - `DELETE /events/:id` (Bearer token) — exclui um evento pendente ou rejeitado.
  - `GET /events/moderation` (Bearer token admin) — lista a fila administrativa com filtro opcional `status=pending|rejected`, retornando também `organizerName`.
  - `PUT /events/:id/moderation` (Bearer token admin) — aprova ou rejeita um evento pendente.

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

- `index.js`: entry da home pública, responsável por filtros, chips, URL state e renderização de eventos.
- `login.js`: entry da página de login, responsável apenas pelas abas visuais de autenticação.
- `dashboard.js`: entry da área autenticada, responsável por sessão, resumo/listagem de eventos e sincronização do estado principal do painel.
- `dashboard/*.js`: controladores de UI específicos do dashboard, responsáveis pelos gatilhos, ciclo de abertura, submissão e template args dos modais relacionados.
- `components/*`: blocos de UI reutilizáveis, como `EventList`, `FilterForm`, `QuickChips`, `AuthTabs`, `StatusAlert` e `EventForm`.
- `helpers/*`: utilitários não-UI para request, template vars, query state, datas e ordenação.
- `public/html/*.html`: fragmentos HTML estáticos consumidos por `Modal.loadContentFromFile(..., { args })`, úteis para corpos de modal reutilizáveis, pré-carregáveis e com substituição segura de placeholders `{{token}}`.

## Ícones e assets visuais

- Font Awesome é a biblioteca de ícones usada no web app e é carregada globalmente pelo bundle via `web/src/css/base.css`.
- Botões, chips, cards, modais e ações do dashboard devem preservar texto visível em um `<span>` e usar o ícone apenas como apoio visual, para manter alinhamento e acessibilidade.
- A dependência fica declarada em `web/package.json`, e o build da web gera também os arquivos de fonte em `web/public/assets/fonts/`.
- Sempre que houver mudança no bundle da web ou em assets do Font Awesome, regenere os arquivos públicos com o mesmo fluxo do projeto, por exemplo: `docker compose -f compose.dev.yaml exec web ./node_modules/.bin/webpack --config webpack.config.js --stats errors-warnings`.