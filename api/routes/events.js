import express from 'express';
import { Event } from '../model/event.js';
import { store } from '../helpers/store.js';
import { authMiddleware } from '../middleware/auth.js';

export const router = express.Router();

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

router.get('/:id', async (req, res) => {
    const event = await store.findEventById(req.params.id);
    if (!event) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    res.json({ event });
});

router.post('/', authMiddleware, async (req, res) => {
    const { title, description, date, category, location, audience } = req.body || {};
    if (!title || !description || !date) {
        return res.status(400).json({ error: 'Título, descrição e data são obrigatórios.' });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Data inválida.' });
    }

    const event = new Event({
        title,
        description,
        date: parsedDate.toISOString(),
        category,
        location,
        audience: Array.isArray(audience)
            ? audience.filter(Boolean)
            : (audience ? audience.split(',').map(a => a.trim()).filter(Boolean) : []),
        organizerId: req.user.id,
    });

    await store.addEvent(event.toJSON());
    res.status(201).json({ event: event.toJSON() });
});
