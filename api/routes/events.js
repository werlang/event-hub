import express from 'express';
import { Event } from '../model/event.js';
import { authMiddleware } from '../middleware/auth.js';
import { CustomError } from '../helpers/error.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';

export const router = express.Router();

/**
 * Re-throws unexpected route failures as API-friendly errors.
 */
function rethrowAsApiError(error, fallbackMessage) {
    if (error instanceof CustomError) {
        throw error;
    }

    throw new CustomError(500, fallbackMessage);
}

/**
 * Lists public events using the supported query-string filters.
 */
router.get('/', async (req, res, next) => {
    try {
        const filters = {
            search: req.query.search || req.query.q,
            category: req.query.category,
            from: req.query.from,
            to: req.query.to,
        };

        const events = await Event.list(filters);
        return sendSuccess(res, { data: { events } });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível carregar os eventos.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Returns the public details for a single event.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            throw new CustomError(404, 'Evento não encontrado.');
        }

        return sendSuccess(res, { data: { event } });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível carregar o evento.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Creates a new event for the authenticated user.
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { title, description, date, category, location } = req.body || {};
        if (!title || !description || !date) {
            throw new CustomError(400, 'Título, descrição e data são obrigatórios.');
        }

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
            throw new CustomError(400, 'Data inválida.');
        }

        const event = new Event({
            title,
            description,
            date: parsedDate.toISOString(),
            category,
            location,
            organizerId: req.user.id,
        });

        const createdEvent = await Event.create(event.toJSON());
        return sendCreated(res, {
            data: { event: createdEvent },
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível salvar o evento.');
        } catch (error) {
            return next(error);
        }
    }
});
