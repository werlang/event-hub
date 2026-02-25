# Academic Events

Projeto inspirado na arquitetura do TrocaAula: dois serviços independentes (API e Web), ambos em Express 5 e ES Modules, para autenticação e publicação de eventos acadêmicos com visualização pública e filtros.

## Serviços

- **API** (`academic-events/api`, porta padrão `4000`): autenticação, cadastro e listagem filtrada de eventos.
- **Web** (`academic-events/web`, porta padrão `4001`): interface SSR Mustache com UI moderna para login/registro, publicação e exploração pública dos eventos.

## Execução rápida

```bash
# Banco de dados (MySQL)
# Ajuste as variáveis de ambiente conforme seu usuário local.
DB_HOST=localhost DB_USER=root DB_PASSWORD=senha DB_NAME=academic_events

# API
cd academic-events/api
npm install
PORT=4000 JWT_SECRET=troca-aula-academic node app.js

# Web (em outro terminal)
cd academic-events/web
npm install
PORT=4001 API_URL=http://localhost:4000 node app.js
```

Abra `http://localhost:4001` para usar. A agenda pública não requer autenticação; o cadastro de eventos exige login.

## Fluxos principais

- **Páginas web**: `/` lista e filtra eventos via query string; `/login` centraliza login/registro e persiste o token; `/publicar` valida o token e abre o formulário de novo evento.
- **Autenticação**: `/auth/register`, `/auth/login`, `/auth/me` retornam token JWT (12h) e dados do usuário.
- **Eventos (API)**:
  - `POST /events` (Bearer token) — cria evento com `title`, `description`, `date`, `category`, `location`, `audience[]`.
  - `GET /events` — lista pública com filtros `search|q`, `category`, `from`, `to`, `audience`.
  - `GET /events/:id` — detalhe público.

## Dados e seeds

- A API inicializa tabelas MySQL (ver `DB_*` acima) e insere:
  - Usuário administrador: `admin@universidade.test` / senha `changeme`.
  - Dois eventos de exemplo para testes visuais.
  - Para desenvolvimento via Docker Compose, use `compose.dev.yaml`, que já sobe um MySQL 8 com credenciais padrão (`DB_HOST=db`, `DB_USER=academic`, `DB_PASSWORD=academic`, `DB_NAME=academic_events`).

## Convenções de código

- ES Modules, Express 5, classes para modelos (`api/model/`), rotas puras em `api/routes/`.
- JWT via `helpers/token.js`; armazenamento simples em JSON via `helpers/datastore.js`.
- UI SSR com Mustache + assets estáticos em `web/public/` (`css` e `js`).

## TODO List

- Revisar e refazer todo o front. Basicamente só o boilerplate está concluído.