# API Route Examples

Patterns aligned with this repository (`auth` + `events`).

## Auth-Protected Route

```javascript
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

export const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
    // req.user is set by auth middleware
    res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});
```

## Basic Validation + 400

```javascript
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    // create user...
    return res.status(201).json({ user, token });
});
```

## Conflict Response + 409

```javascript
const existing = await store.findUserByEmail(email);
if (existing) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
}
```

## Filtered List Endpoint

```javascript
router.get('/', async (req, res) => {
    const filters = {
        search: req.query.search || req.query.q,
        category: req.query.category,
        from: req.query.from,
        to: req.query.to,
        audience: req.query.audience,
    };

    const events = await store.listEvents(filters);
    res.json({ events });
});
```

## Not Found + 404

```javascript
router.get('/:id', async (req, res) => {
    const event = await store.findEventById(req.params.id);
    if (!event) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
    }
    res.json({ event });
});
```