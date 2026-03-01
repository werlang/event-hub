---
name: entity-models
description: Work with domain models for users and events, including password hashing, defaults, and serialization. Use when changing `User` or `Event` behavior, datastore seeding/migration logic, filtering semantics, or model fields that affect API contracts.
---

# Entity Models and Domain Logic

## Current Domain Model

### User (`api/model/user.js`)

- Fields: `id`, `name`, `email`, private `#passwordHash`
- `id` defaults to `crypto.randomUUID()`
- `email` normalized to lowercase
- Password hash: `bcrypt.hashSync(plain, 12)`
- Password validation uses `bcrypt.compareSync`

### Event (`api/model/event.js`)

- Fields: `id`, `title`, `description`, `date`, `category`, `location`, `organizerId`, `createdAt`
- `id` defaults to `crypto.randomUUID()`
- `category` default: `'Geral'`
- `location` default: `'A definir'`
- `createdAt` default: current ISO datetime

## Filtering Rules (`listEvents`)

- `category`: case-insensitive exact match
- `from` / `to`: date range checks using `new Date(event.date)`
- `search`: checks combined `title + description + location + category`
- final output sorted by `event.date` ascending

## Safe Change Guidelines

- Keep `toJSON()` stable unless API contracts intentionally change.
- Preserve secure password handling (bcrypt hashing and comparison).
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