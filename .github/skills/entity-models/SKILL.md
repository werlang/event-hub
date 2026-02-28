---
name: entity-models
description: Work with domain models for users and events, including password hashing, defaults, serialization, and relation-backed audience persistence. Use when changing `User` or `Event` behavior, datastore seeding/migration logic, filtering semantics, or model fields that affect API contracts.
---

# Entity Models and Domain Logic

## Current Domain Model

### User (`api/model/user.js`)

- Fields: `id`, `name`, `email`, private `#salt`, private `#passwordHash`
- `id` defaults to `crypto.randomUUID()`
- `email` normalized to lowercase
- Password hash: `pbkdf2Sync(plain, salt, 310000, 32, 'sha256')`
- Password validation uses `crypto.timingSafeEqual`

### Event (`api/model/event.js`)

- Fields: `id`, `title`, `description`, `date`, `category`, `location`, `audience`, `organizerId`, `createdAt`
- `id` defaults to `crypto.randomUUID()`
- `category` default: `'Geral'`
- `location` default: `'A definir'`
- `audience` default: `[]`
- `createdAt` default: current ISO datetime

## Persistence Layer

`DataStore` in `api/helpers/datastore.js`:

- Connects to MySQL via `Mysql`
- Creates `users`, `events`, and `event_audiences` tables
- Migrates legacy `events.audience` JSON data into `event_audiences` (idempotent)
- Seeds default admin user and two initial events when users table is empty
- Provides CRUD-ish methods used by routes:
  - users: `findUserByEmail`, `findUserById`, `addUser`
  - events: `listEvents`, `findEventById`, `addEvent`, `deleteEvent`

`Event` audience persistence:

- `event_audiences` is the source of truth
- API output still exposes `audience: string[]`
- Writes use relation replacement with deduplication semantics

## Filtering Rules (`listEvents`)

- `category`: case-insensitive exact match
- `from` / `to`: date range checks using `new Date(event.date)`
- `audience`: case-insensitive substring match in audience tags
- `search`: checks combined `title + description + location + category`
- final output sorted by `event.date` ascending

## Safe Change Guidelines

- Keep `toJSON()` stable unless API contracts intentionally change.
- Preserve secure password handling (salted hash plus timing-safe comparison).
- If adding model fields, update all affected surfaces:
  - model constructor
  - `toJSON()`
  - `serialize()` and `normalize()`
  - datastore seed/defaults
  - route validation and docs
- Avoid cross-service coupling; API and Web remain independent packages.

## Out of Scope (Not in This Repo)

- Timetable entities (Professor/Class/Classroom/Subject/Card)
- Entity expansion helpers
- Redis or external API-backed models