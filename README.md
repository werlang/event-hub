# Academic Events

Projeto inspirado na arquitetura do TrocaAula: dois serviços independentes (API e Web), ambos em Express 5 e ES Modules, para autenticação e publicação de eventos acadêmicos com visualização pública e filtros.

## Serviços

- **API** (`academic-events/api`, porta padrão `4000`): autenticação, cadastro e listagem filtrada de eventos.
- **Web** (`academic-events/web`, porta padrão `4001`): interface SSR Mustache com UI moderna para login/registro, publicação e exploração pública dos eventos.

## Execução rápida

```bash
# API
cd academic-events/api
npm install
JWT_SECRET=troca-aula-academic node app.js

# Web (em outro terminal)
cd academic-events/web
npm install
API_URL=http://localhost:4000 node app.js
```

Abra `http://localhost:4001` para usar. A agenda pública não requer autenticação; o cadastro de eventos exige login.

## Fluxos principais

- **Autenticação**: `/auth/register`, `/auth/login`, `/auth/me` retornam token JWT (12h) e dados do usuário.
- **Eventos**:
  - `POST /events` (Bearer token) — cria evento com `title`, `description`, `date`, `category`, `location`, `audience[]`.
  - `GET /events` — lista pública com filtros `search|q`, `category`, `from`, `to`, `audience`.
  - `GET /events/:id` — detalhe público.

## Dados e seeds

A API cria automaticamente `academic-events/api/data/database.json` na primeira execução, com:
- Usuário administrador: `admin@universidade.test` / senha `changeme`.
- Dois eventos de exemplo para testes visuais.

## Convenções de código

- ES Modules, Express 5, classes para modelos (`api/model/`), rotas puras em `api/routes/`.
- JWT via `helpers/token.js`; armazenamento simples em JSON via `helpers/datastore.js`.
- UI SSR com Mustache + assets estáticos em `web/public/` (`css` e `js`).
