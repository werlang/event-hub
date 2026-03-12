---
name: entity-models
description: Work with domain models for users and events, including password hashing, defaults, serialization, and MySQL-backed query helpers. Use when changing model behavior, filtering semantics, or fields that affect API contracts.
---

# Entity Models and Domain Logic

## Current Domain Model

### User (`api/model/user.js`)

- Fields: `id`, `name`, `email`, private `#passwordHash`
- `id` defaults to `crypto.randomUUID()`
- `email` normalized to lowercase
- `role` normalized to `admin` or `member`
- Password hash: `bcrypt.hashSync(plain, 12)`
- Password validation uses `bcrypt.compareSync`

### Event (`api/model/event.js`)

- Fields: `id`, `title`, `description`, `date`, `category`, `location`, `organizerId`, `createdAt`
- `id` defaults to `crypto.randomUUID()`
- `category` default: `'Geral'`
- `location` default: `'A definir'`
- `createdAt` default: current ISO datetime

## Filtering Rules (`listEvents`)

- `from` / `to` are pushed into the SQL query through the `Mysql` driver's range helpers
- result rows are fetched ordered by `date` ascending
- `category`: case-insensitive exact match after normalization
- `search`: checks combined `title + description + location + category` after rows are normalized

## Safe Change Guidelines

- Keep `toJSON()` stable unless API contracts intentionally change.
- Preserve secure password handling (bcrypt hashing and comparison).
- If adding model fields, update all affected surfaces:
  - model constructor
  - `toJSON()`
  - `serialize()` and `normalize()`
  - schema columns and SQL names if persistence changes
  - route validation and docs
- Keep models extending the shared `Model` base class and let the `Mysql` driver handle query building.
- Be careful with date fields: `serialize()` converts to MySQL datetime strings and `normalize()` converts back to ISO strings.
- Avoid cross-service coupling; API and Web remain independent packages.

## Out of Scope (Not in This Repo)

- Timetable entities (Professor/Class/Classroom/Subject/Card)
- Entity expansion helpers
- Redis or external API-backed models