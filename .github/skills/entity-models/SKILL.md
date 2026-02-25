---
name: entity-models
description: Work with domain models for users and events, including password hashing, defaults, serialization, and JSON persistence. Use when changing `User` or `Event` behavior, datastore seeding, filtering semantics, or model fields that affect API contracts.
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

- Loads `api/data/database.json` or creates it if missing
- Seeds default admin user and two initial events
- Provides CRUD-ish methods used by routes:
  - users: `findUserByEmail`, `findUserById`, `addUser`
  - events: `listEvents`, `findEventById`, `addEvent`, `deleteEvent`

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
  - datastore seed/defaults
  - route validation and docs
- Avoid cross-service coupling; API and Web remain independent packages.

## Out of Scope (Not in This Repo)

- Timetable entities (Professor/Class/Classroom/Subject/Card)
- Entity expansion helpers
- Redis or external API-backed models