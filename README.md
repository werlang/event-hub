# Academic Events

Aplicação com dois serviços independentes, ambos em Express 5 e ES Modules, para autenticação, e publicação de eventos acadêmicos com visualização pública e filtros.

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

## Fluxos principais

- **Páginas web**: `/` opera em dois modos (neutro sem carregar eventos por padrão, ou agenda-only quando acessada com query de filtro); `/login` renderiza a troca visual entre abas de entrada e registro; `/publish` renderiza o formulário de publicação.
- **Home (`/`)**: filtros por busca/categoria/período e chips rápidos (esta semana, próximos 7 dias e categorias) sincronizam a URL para compartilhamento de estado.
- **Home em modo agenda-only por link**: ao acessar `/` com query relevante (`search|q`, `category`, `from`, `to`), a tela prioriza apenas os resultados da agenda e oculta superfícies de entrada.
- **Autenticação**:
  - `POST /auth/register` exige `name`, `email` e `password`, e retorna token JWT (12h) + usuário.
  - `POST /auth/login` retorna token JWT (12h) + usuário.
  - `GET /auth/me` retorna sessão atual (incluindo `role`).
- **Login/Register (`/login`)**: a interface alterna entre abas, sincroniza `#register` na URL, envia login/registro ao backend, persiste o token localmente e redireciona após autenticar.
- **Publicação (`/publish`)**: a página SSR já contém o formulário e o toggle de horário, mas o repositório ainda não possui um bundle dedicado para validar sessão e enviar o formulário.
- **Eventos (API)**:
  - `POST /events` (Bearer token) — cria evento com `title`, `description`, `date`, `category`, `location`.
  - `GET /events` — lista pública com filtros `search|q`, `category`, `from`, `to`.
  - `GET /events/:id` — detalhe público.

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
- Para desenvolvimento via Docker Compose, use `compose.dev.yaml`, que sobe `api`, `web` e `mysql`.

## Roles

- `POST /auth/register` é aberto e cria contas diretamente com papel padrão `member`.
- Usuários têm `role` persistido (`admin` ou `member`), incluído no payload do JWT e nas respostas de autenticação.

## Convenções de código

- ES Modules, Express 5, classes para modelos (`api/model/`), rotas puras em `api/routes/`.
- JWT via `helpers/token.js`; persistência MySQL com helper/driver em `api/helpers/mysql.js` e base `Model` em `api/model/model.js`.
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
- `components/*`: blocos de UI reutilizáveis, como `EventList`, `FilterForm`, `QuickChips`, `AuthTabs`, `StatusAlert` e `EventForm`.
- `helpers/*`: utilitários não-UI para request, template vars, query state, datas e ordenação.