import express from 'express';
import { Event } from '../model/event.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminUser } from '../middleware/authorization.js';
import { assertAdminCanModerateEvent, assertOwnerCanDeleteEvent, assertOwnerCanEditEvent } from '../middleware/event-authorization.js';
import { HttpError } from '../helpers/error.js';
import { normalizeEventCategoryId } from '../helpers/event-category.js';
import { GoogleCalendarPublisher } from '../helpers/google-calendar.js';
import { EventUpdateNotificationManager } from '../helpers/event-update-notification-manager.js';
import { PendingEventNotificationManager } from '../helpers/pending-event-notification-manager.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';
import { User } from '../model/user.js';

export const router = express.Router();

const ALLOW_SELF_MODERATION = true;
const pendingEventNotificationManager = new PendingEventNotificationManager();
const eventUpdateNotificationManager = new EventUpdateNotificationManager();

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
 * Parses the moderation decision payload accepted by administrators.
 */
function parseModerationDecisionPayload(payload = {}) {
    const status = parseModerationDecisionStatus(payload.status);

    return {
        status,
        rejectionReason: status === Event.STATUS_REJECTED
            ? Event.normalizeRejectionReason(payload.rejectionReason)
            : null,
    };
}

/**
 * Attempts to notify opted-in administrators that an event entered the moderation queue.
 */
async function notifyPendingApproval(event, organizer) {
    try {
        await pendingEventNotificationManager.notifyPendingApproval({
            event,
            organizer,
        });
    } catch (error) {
        console.error('Failed to send pending-event admin notification:', error);
    }
}

/**
 * Attempts to notify one opted-in owner that an administrator edited the event.
 */
async function notifyOwnerAboutAdminEdit(event, owner, editor) {
    try {
        await eventUpdateNotificationManager.notifyEventUpdated({
            event,
            owner,
            editor,
        });
    } catch (error) {
        console.error('Failed to send event-update owner notification:', error);
    }
}

/**
 * Attempts to notify one opted-in owner that an administrator deleted the event.
 */
async function notifyOwnerAboutAdminDelete(event, owner, editor) {
    try {
        await eventUpdateNotificationManager.notifyEventDeleted({
            event,
            owner,
            editor,
        });
    } catch (error) {
        console.error('Failed to send event-delete owner notification:', error);
    }
}

/**
 * Reports whether the current authenticated actor is an administrator.
 */
function isAdminUser(user) {
    return String(user?.role || '').trim().toLowerCase() === 'admin';
}

/**
 * Resolves the moderation transition used by the current authenticated editor.
 */
function readEventEditTransition(currentEvent, user) {
    if (!currentEvent) {
        throw new HttpError(404, 'Evento não encontrado.');
    }

    if (isAdminUser(user)) {
        return {
            targetStatus: Event.STATUS_PENDING,
            message: 'Evento atualizado e enviado para moderação.',
            shouldNotifyOwner: true,
            shouldNotifyPendingApproval: false,
        };
    }

    assertOwnerCanEditEvent(currentEvent, user);

    return {
        targetStatus: Event.STATUS_PENDING,
        message: 'Evento atualizado e enviado para moderação.',
        shouldNotifyOwner: false,
        shouldNotifyPendingApproval: currentEvent.status !== Event.STATUS_PENDING || Boolean(currentEvent.calendarEventId),
    };
}

/**
 * Resolves whether the current authenticated actor may delete the target event.
 */
function readEventDeleteTransition(currentEvent, user) {
    if (!currentEvent) {
        throw new HttpError(404, 'Evento não encontrado.');
    }

    if (isAdminUser(user)) {
        return {
            shouldNotifyOwner: currentEvent.organizerId !== user?.id,
        };
    }

    assertOwnerCanDeleteEvent(currentEvent, user);

    return {
        shouldNotifyOwner: false,
    };
}

/**
 * Detects whether a calendar deletion error means the entry was already removed.
 */
function isMissingCalendarEventError(error) {
    const statusCode = Number(
        error?.status
        || error?.statusCode
        || error?.code
        || error?.response?.status,
    );

    if (statusCode === 404) {
        return true;
    }

    const normalizedMessage = String(error?.message || '').trim().toLowerCase();
    return normalizedMessage.includes('not found') || normalizedMessage.includes('already deleted');
}

/**
 * Deletes a persisted calendar entry and tolerates already-missing events for retry safety.
 */
async function deleteCalendarEntryIfPresent(calendarEventId) {
    if (!calendarEventId) {
        return;
    }

    try {
        await GoogleCalendarPublisher.deleteEvent(calendarEventId);
    } catch (error) {
        if (!isMissingCalendarEventError(error)) {
            throw error;
        }
    }
}

/**
 * Persists an event edit back into the moderation queue while keeping calendar metadata until cleanup succeeds.
 */
async function updateEventForModeration(currentEvent, payload, { targetStatus } = {}) {
    const shouldDeleteCalendarEntry = Boolean(currentEvent.calendarEventId);
    const updatedEvent = await Event.updateDetails(currentEvent.id, {
        ...payload,
        status: targetStatus || Event.STATUS_PENDING,
        rejectionReason: null,
        calendarLink: shouldDeleteCalendarEntry ? currentEvent.calendarLink : null,
        calendarEventId: shouldDeleteCalendarEntry ? currentEvent.calendarEventId : null,
    });

    if (!shouldDeleteCalendarEntry) {
        return updatedEvent;
    }

    await deleteCalendarEntryIfPresent(currentEvent.calendarEventId);

    return Event.updateDetails(currentEvent.id, {
        calendarLink: null,
        calendarEventId: null,
    });
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
router.get('/moderation', authMiddleware, requireAdminUser, async (req, res, next) => {
    try {
        const events = await Event.listForModeration({
            moderatorId: ALLOW_SELF_MODERATION ? undefined : req.user.id,
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

        notifyPendingApproval(createdEvent, req.user).catch((error) => {
            console.error('Failed to send pending-event admin notification after event creation:', error);
        });

        return sendCreated(res, {
            data: { event: createdEvent },
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível salvar o evento.', err));
    }
});

/**
 * Updates an organizer-owned event and reopens it for moderation when needed.
 */
router.put('/:id', 
    authMiddleware, 
    async (req, res, next) => {
    try {
        const currentEvent = await Event.findById(req.params.id);
        const transition = readEventEditTransition(currentEvent, req.user);
        const updatedEvent = await updateEventForModeration(currentEvent, parseEventPayload(req.body), {
            targetStatus: transition.targetStatus,
        });

        if (transition.shouldNotifyPendingApproval) {
            notifyPendingApproval(updatedEvent, req.user).catch((error) => {
                console.error('Failed to send pending-event admin notification after event update:', error);
            });
        }

        if (transition.shouldNotifyOwner) {
            const owner = await User.findById(currentEvent.organizerId);
            notifyOwnerAboutAdminEdit(updatedEvent, owner, req.user).catch((error) => {
                console.error('Failed to send event-update owner notification after event update:', error);
            });
        }

        return sendSuccess(res, {
            data: { event: updatedEvent },
            message: transition.message,
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível atualizar o evento.', err));
    }
});

/**
 * Deletes an owner-managed or admin-managed event with calendar cleanup.
 */
router.delete('/:id', 
    authMiddleware, 
    async (req, res, next) => {
    try {
        const currentEvent = await Event.findById(req.params.id);
        const transition = readEventDeleteTransition(currentEvent, req.user);

        await Event.remove(currentEvent.id);

        if (currentEvent.calendarEventId) {
            try {
                await deleteCalendarEntryIfPresent(currentEvent.calendarEventId);
            } catch (error) {
                console.error('Failed to delete calendar entry after event removal:', error);
            }
        }

        if (transition.shouldNotifyOwner) {
            const owner = await User.findById(currentEvent.organizerId);
            notifyOwnerAboutAdminDelete(currentEvent, owner, req.user).catch((error) => {
                console.error('Failed to send event-delete owner notification after event removal:', error);
            });
        }

        return sendSuccess(res, {
            data: { id: currentEvent.id },
            message: 'Evento excluído com sucesso.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível excluir o evento.', err));
    }
});

/**
 * Approves or rejects an unpublished event from another organizer.
 */
router.put('/:id/moderation', 
    authMiddleware, 
    requireAdminUser,
    async (req, res, next) => {
    try {
        const currentEvent = await Event.findById(req.params.id);
        assertAdminCanModerateEvent(currentEvent, req.user, { allowSelfModeration: ALLOW_SELF_MODERATION });

        const moderationDecision = parseModerationDecisionPayload(req.body);

        let createdCalendarEntry = null;

        try {
            if (moderationDecision.status === Event.STATUS_PUBLISHED) {
                createdCalendarEntry = await GoogleCalendarPublisher.publishApprovedEvent(currentEvent);
            }

            const updatedEvent = await Event.updateStatus(currentEvent.id, moderationDecision.status, {
                rejectionReason: moderationDecision.rejectionReason,
                calendarLink: createdCalendarEntry?.htmlLink || null,
                calendarEventId: createdCalendarEntry?.id || null,
            });
            const message = moderationDecision.status === Event.STATUS_PUBLISHED
                ? 'Evento aprovado e publicado.'
                : 'Evento rejeitado.';

            return sendSuccess(res, {
                data: { event: updatedEvent },
                message,
            });
        } catch (error) {
            if (createdCalendarEntry?.id) {
                try {
                    await GoogleCalendarPublisher.deleteEvent(createdCalendarEntry.id);
                } catch {
                    // Best-effort cleanup to avoid orphan calendar entries after persistence failures.
                }
            }

            throw error;
        }
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível moderar o evento.', err));
    }
});
