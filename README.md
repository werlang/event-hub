# Academic Events

Projeto inspirado na arquitetura do TrocaAula: dois serviços independentes (API e Web), ambos em Express 5 e ES Modules, para autenticação e publicação de eventos acadêmicos com visualização pública e filtros.

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

## Fluxos principais

- **Páginas web**: `/` opera em dois modos (neutro sem carregar eventos por padrão, ou agenda-only quando acessada com query de filtro); `/login` centraliza login/registro e persiste o token; `/publish` valida o token e abre o formulário de novo evento.
- **Home (`/`)**: filtros por busca/categoria/período e chips rápidos (esta semana, próximos 7 dias e categorias) sincronizam a URL para compartilhamento de estado.
- **Home em modo agenda-only por link**: ao acessar `/` com query relevante (`search|q`, `category`, `from`, `to`), a tela prioriza apenas os resultados da agenda e oculta superfícies de entrada.
- **Autenticação**:
  - `POST /auth/register` exige `inviteToken` válido e retorna token JWT (12h) + usuário.
  - `POST /auth/login` retorna token JWT (12h) + usuário.
  - `GET /auth/me` retorna sessão atual (incluindo `role`).
  - `POST /auth/invites` (Bearer admin) gera convite one-time com expiração.
- **Login/Register (`/login`)**: registro permanece visível porém desabilitado sem convite válido; com `inviteToken` válido na URL, o envio de registro é habilitado.
- **Publicação (`/publish`)**: formulário aceita data obrigatória com horário opcional via toggle `Informar horário`.
  - Toggle desligado: envia `date` como `YYYY-MM-DD` (data-only).
  - Toggle ligado: envia `date` como `YYYY-MM-DDTHH:mm` (data+hora).
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

- O schema oficial do banco está em `api/data/schema.sql` (tabelas `users`, `events`, `invites`).
- No bootstrap, a API executa esse schema e insere:
  - Usuário administrador: `admin@universidade.test` / senha `changeme` (role `admin`).
  - Dois eventos de exemplo para testes visuais.
  - Para desenvolvimento via Docker Compose, use `compose.dev.yaml`, que sobe `api`, `web` e `mysql`.

## Convites e roles

- Cadastro público está desabilitado sem convite: chamadas em `/auth/register` sem `inviteToken` falham.
- Convites são de uso único e expiram; convites usados/expirados são rejeitados.
- Usuários têm `role` persistido (`admin` ou `member`), incluído no payload do JWT e nas respostas de autenticação.

## Convenções de código

- ES Modules, Express 5, classes para modelos (`api/model/`), rotas puras em `api/routes/`.
- JWT via `helpers/token.js`; persistência MySQL com helper/driver em `api/helpers/mysql.js`.
- UI SSR com Mustache + assets estáticos em `web/public/` (`css` e `js`).

## Arquitetura frontend (web/src/js)

- `index.js`: dispatcher por página usando `TemplateVar.get('page')`.
- `pages/*`: orquestração de fluxo por rota (`home-page`, `login-page`, `publish-page`).
- `components/*`: blocos de UI reutilizáveis e desacoplados de chamadas de API.
- `helpers/*`: utilitários não-UI (request, template vars, query state, data e ordenação).