import express from 'express';
import { Event } from '../model/event.js';
import { authMiddleware } from '../middleware/auth.js';
import { HttpError } from '../helpers/error.js';
import { normalizeEventCategoryId } from '../helpers/event-category.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';

export const router = express.Router();

/**
 * Validates and normalizes the editable event fields required by create and update flows.
 */
function parseEventPayload(payload = {}) {
    const title = String(payload.title || '').trim();
    const description = String(payload.description || '').trim();
    const category = normalizeEventCategoryId(payload.category, { fallback: 'outro' });
    const location = String(payload.location || '').trim() || 'A definir';

    if (!title || !description || !payload.date) {
        throw new HttpError(400, 'Título, descrição e data são obrigatórios.');
    }

    const parsedDate = new Date(payload.date);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new HttpError(400, 'Data inválida.');
    }

    return {
        title,
        description,
        date: parsedDate.toISOString(),
        category,
        location,
    };
}

/**
 * Ensures the authenticated user has admin privileges.
 */
function requireAdminUser(user) {
    if (user?.role !== 'admin') {
        throw new HttpError(403, 'Acesso restrito a administradores.');
    }
}

/**
 * Ensures the requested event exists.
 */
function ensureEventExists(event) {
    if (!event) {
        throw new HttpError(404, 'Evento não encontrado.');
    }
}

/**
 * Ensures the authenticated owner can still manage the target event.
 */
function ensureOwnerCanManageEvent(event, user) {
    ensureEventExists(event);

    if (event.organizerId !== user?.id) {
        throw new HttpError(403, 'Você não tem permissão para gerenciar este evento.');
    }

    if (!Event.canOwnerManageStatus(event.status)) {
        throw new HttpError(403, 'Somente eventos pendentes ou rejeitados podem ser editados ou excluídos.');
    }
}

/**
 * Ensures the authenticated administrator can moderate the target event.
 */
function ensureAdminCanModerateEvent(event, user) {
    ensureEventExists(event);

    if (event.organizerId === user?.id) {
        throw new HttpError(403, 'Administradores não podem moderar os próprios eventos.');
    }

    if (Event.isPublishedStatus(event.status)) {
        throw new HttpError(400, 'Somente eventos não publicados podem ser moderados.');
    }
}

/**
 * Parses the optional moderation queue filter status.
 */
function parseModerationQueueStatus(value) {
    if (value === undefined) {
        return undefined;
    }

    const normalizedStatus = String(value || '').trim().toLowerCase();
    const isSupportedStatus = Event.ALLOWED_STATUSES.includes(normalizedStatus);

    if (!isSupportedStatus || normalizedStatus === Event.STATUS_PUBLISHED) {
        throw new HttpError(400, 'Use apenas os status pending ou rejected para filtrar a moderação.');
    }

    return normalizedStatus;
}

/**
 * Parses the moderation decision status accepted by administrators.
 */
function parseModerationDecisionStatus(value) {
    const normalizedStatus = String(value || '').trim().toLowerCase();
    const allowedStatuses = [Event.STATUS_PUBLISHED, Event.STATUS_REJECTED];

    if (!allowedStatuses.includes(normalizedStatus)) {
        throw new HttpError(400, 'Informe um status de moderação válido: published ou rejected.');
    }

    return normalizedStatus;
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
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível carregar os eventos.', err));
    }
});

/**
 * Lists the authenticated user's events ordered by event date descending.
 */
router.get('/mine', authMiddleware, async (req, res, next) => {
    try {
        const events = await Event.listByOrganizer(req.user.id);
        return sendSuccess(res, { data: { events } });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível carregar os seus eventos.', err));
    }
});

/**
 * Lists unpublished events from other organizers for administrators.
 */
router.get('/moderation', authMiddleware, async (req, res, next) => {
    try {
        requireAdminUser(req.user);

        const events = await Event.listForModeration({
            moderatorId: req.user.id,
            status: parseModerationQueueStatus(req.query.status),
        });

        return sendSuccess(res, { data: { events } });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível carregar a fila de moderação.', err));
    }
});

/**
 * Returns the public details for a single event.
 */
router.get('/:id', async (req, res, next) => {
    try {
        const event = await Event.findPublicById(req.params.id);
        if (!event) {
            throw new HttpError(404, 'Evento não encontrado.');
        }

        return sendSuccess(res, { data: { event } });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível carregar o evento.', err));
    }
});

/**
 * Creates a new event for the authenticated user.
 */
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const event = parseEventPayload(req.body);

        const createdEvent = await Event.create({
            ...event,
            organizerId: req.user.id,
        });

        return sendCreated(res, {
            data: { event: createdEvent },
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível salvar o evento.', err));
    }
});

/**
 * Updates an event still pending moderation or already rejected.
 */
router.patch('/:id', authMiddleware, async (req, res, next) => {
    try {
        const currentEvent = await Event.findById(req.params.id);
        ensureOwnerCanManageEvent(currentEvent, req.user);

        const updatedEvent = await Event.updateDetails(currentEvent.id, {
            ...parseEventPayload(req.body),
            status: Event.STATUS_PENDING,
        });

        return sendSuccess(res, {
            data: { event: updatedEvent },
            message: 'Evento atualizado e enviado para moderação.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível atualizar o evento.', err));
    }
});

/**
 * Deletes an event still pending moderation or already rejected.
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const currentEvent = await Event.findById(req.params.id);
        ensureOwnerCanManageEvent(currentEvent, req.user);

        await Event.remove(currentEvent.id);
        return sendSuccess(res, {
            data: { id: currentEvent.id },
            message: 'Evento excluído.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível excluir o evento.', err));
    }
});

/**
 * Approves or rejects an unpublished event from another organizer.
 */
router.patch('/:id/moderation', authMiddleware, async (req, res, next) => {
    try {
        requireAdminUser(req.user);

        const currentEvent = await Event.findById(req.params.id);
        ensureAdminCanModerateEvent(currentEvent, req.user);

        const status = parseModerationDecisionStatus(req.body?.status);
        const updatedEvent = await Event.updateStatus(currentEvent.id, status);
        const message = status === Event.STATUS_PUBLISHED
            ? 'Evento aprovado e publicado.'
            : 'Evento rejeitado.';

        return sendSuccess(res, {
            data: { event: updatedEvent },
            message,
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível moderar o evento.', err));
    }
});
