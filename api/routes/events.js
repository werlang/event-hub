import express from 'express';
import { Event } from '../model/event.js';
import { store } from '../helpers/store.js';
import { authMiddleware } from '../middleware/auth.js';
import CustomError from '../helpers/error.js';
import { sendSuccess } from '../helpers/response.js';

export const router = express.Router();

router.get('/', async (req, res, next) => {
    const filters = {
        search: req.query.search || req.query.q,
        category: req.query.category,
        from: req.query.from,
        to: req.query.to,
        audience: req.query.audience,
    };

    try {
        const events = await store.listEvents(filters);
        return sendSuccess(res, { data: { events } });
    } catch (err) {
        return next(new CustomError(500, 'Não foi possível carregar os eventos.'));
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const event = await store.findEventById(req.params.id);
        if (!event) {
            return next(new CustomError(404, 'Evento não encontrado.'));
        }

        return sendSuccess(res, { data: { event } });
    } catch (err) {
        return next(new CustomError(500, 'Não foi possível carregar o evento.'));
    }
});

router.post('/', authMiddleware, async (req, res, next) => {
    const { title, description, date, category, location, audience } = req.body || {};
    if (!title || !description || !date) {
        return next(new CustomError(400, 'Título, descrição e data são obrigatórios.'));
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
        return next(new CustomError(400, 'Data inválida.'));
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

    try {
        const createdEvent = await store.addEvent(event.toJSON());
        return sendSuccess(res, {
            status: 201,
            data: { event: createdEvent },
        });
    } catch (err) {
        return next(new CustomError(500, 'Não foi possível salvar o evento.'));
    }
});
