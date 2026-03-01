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

- **Páginas web**: `/` lista e filtra eventos via query string; `/login` centraliza login/registro e persiste o token; `/publish` valida o token e abre o formulário de novo evento.
- **Autenticação**: `/auth/register`, `/auth/login`, `/auth/me` retornam token JWT (12h) e dados do usuário.
- **Eventos (API)**:
  - `POST /events` (Bearer token) — cria evento com `title`, `description`, `date`, `category`, `location`.
  - `GET /events` — lista pública com filtros `search|q`, `category`, `from`, `to`.
  - `GET /events/:id` — detalhe público.

## Contrato de resposta

- **Sucesso**: `{ error: false, status, data, message? }`
- **Erro**: `{ error: true, status, type, message, data? }`

## Dados e seeds

- O schema oficial do banco está em `api/data/schema.sql` (tabelas `users`, `events`).
- No bootstrap, a API executa esse schema e insere:
  - Usuário administrador: `admin@universidade.test` / senha `changeme`.
  - Dois eventos de exemplo para testes visuais.
  - Para desenvolvimento via Docker Compose, use `compose.dev.yaml`, que sobe `api`, `web` e `mysql`.

## Convenções de código

- ES Modules, Express 5, classes para modelos (`api/model/`), rotas puras em `api/routes/`.
- JWT via `helpers/token.js`; persistência MySQL com helper/driver em `api/helpers/mysql.js`.
- UI SSR com Mustache + assets estáticos em `web/public/` (`css` e `js`).