# API Route Examples

Patterns aligned with this repository (`auth` + `events`).

## Auth-Protected Route

```javascript
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../helpers/response.js';
import CustomError from '../helpers/error.js';

export const router = express.Router();

router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        if (!req.user?.id) {
            throw new CustomError(401, 'Sessão inválida ou expirada.');
        }

        return sendSuccess(res, {
            data: { user: { id: req.user.id, name: req.user.name, email: req.user.email } },
        });
    } catch (error) {
        return next(error);
    }
});
```

## Basic Validation + 400

```javascript
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) {
            throw new CustomError(400, 'Nome, e-mail e senha são obrigatórios.');
        }

        // create user...
        return sendCreated(res, { data: { user, token } });
    } catch (error) {
        return next(error);
    }
});
```

## Conflict Response + 409

```javascript
const existing = await store.findUserByEmail(email);
if (existing) {
    throw new CustomError(409, 'Já existe uma conta com este e-mail.');
}
```

## Filtered List Endpoint

```javascript
router.get('/', async (req, res, next) => {
    try {
        const filters = {
            search: req.query.search || req.query.q,
            category: req.query.category,
            from: req.query.from,
            to: req.query.to,
        };

        const events = await store.listEvents(filters);
        return sendSuccess(res, { data: { events } });
    } catch (error) {
        return next(error);
    }
});
```

## Not Found + 404

```javascript
router.get('/:id', async (req, res, next) => {
    try {
        const event = await store.findEventById(req.params.id);
        if (!event) {
            throw new CustomError(404, 'Evento não encontrado.');
        }

        return sendSuccess(res, { data: { event } });
    } catch (error) {
        return next(error);
    }
});
```